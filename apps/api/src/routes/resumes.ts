import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@saarthi/database';
import { parsePdfBuffer, parseDocxBuffer, extractStructuredResume, generateTailoredLatex } from '@saarthi/resume';

export async function resumeRoutes(app: FastifyInstance) {
  // GET all resume templates
  app.get('/', async (_req: FastifyRequest, reply: FastifyReply) => {
    let profile = await prisma.profile.findFirst();
    if (!profile) {
      const user = await prisma.user.findFirst();
      if (user) {
        profile = await prisma.profile.create({
          data: { userId: user.id, location: 'Noida, India' },
        });
      }
    }

    if (!profile) {
      return reply.send({ resumes: [] });
    }

    let resumes = await prisma.resume.findMany({
      where: { profileId: profile.id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
      orderBy: { isMaster: 'desc' },
    });

    // If no resume template exists yet, initialize the Master Resume template
    if (resumes.length === 0) {
      const master = await prisma.resume.create({
        data: {
          profileId: profile.id,
          title: 'Master Resume',
          targetRole: 'Full Stack & Backend Engineer',
          isMaster: true,
          versions: {
            create: {
              versionNumber: 1,
              content: JSON.stringify({
                summary: profile.bio || 'Backend & Systems Engineer',
                education: JSON.parse(profile.education || '[]'),
              }),
              atsScore: 92,
            },
          },
        },
        include: { versions: true },
      });
      resumes = [master];
    }

    return reply.send({
      resumes: resumes.map((r: any) => ({
        id: r.id,
        title: r.title,
        targetRole: r.targetRole,
        isMaster: r.isMaster,
        updatedAt: r.updatedAt,
        versionCount: r.versions.length,
        latestVersion: r.versions[0]
          ? {
              id: r.versions[0].id,
              versionNumber: r.versions[0].versionNumber,
              atsScore: r.versions[0].atsScore,
              createdAt: r.versions[0].createdAt,
            }
          : null,
      })),
    });
  });

  // GET specific resume with versions
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;

    const resume = await prisma.resume.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            sources: true,
            job: {
              select: { id: true, title: true, company: true },
            },
          },
        },
      },
    });

    if (!resume) return reply.status(404).send({ error: 'Resume template not found' });

    return reply.send({
      id: resume.id,
      title: resume.title,
      targetRole: resume.targetRole,
      isMaster: resume.isMaster,
      versions: resume.versions.map((v: any) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        jobId: v.jobId,
        job: v.job,
        content: JSON.parse(v.content || '{}'),
        fileUrlPdf: v.fileUrlPdf,
        atsScore: v.atsScore,
        createdAt: v.createdAt,
        sourcesCount: v.sources.length,
      })),
    });
  });

  // POST create new template (e.g. "Backend Resume", "AI Engineer Resume")
  app.post('/', async (req: FastifyRequest<{ Body: { title: string; targetRole?: string } }>, reply: FastifyReply) => {
    const { title, targetRole } = req.body || {};
    if (!title) return reply.status(400).send({ error: 'Title is required' });

    const profile = await prisma.profile.findFirst();
    if (!profile) return reply.status(404).send({ error: 'Profile not found' });

    const resume = await prisma.resume.create({
      data: {
        profileId: profile.id,
        title,
        targetRole,
        isMaster: false,
        versions: {
          create: {
            versionNumber: 1,
            content: JSON.stringify({
              summary: `Tailored template for ${targetRole || title}`,
            }),
            atsScore: 85,
          },
        },
      },
      include: { versions: true },
    });

    return reply.status(201).send(resume);
  });

  // POST Upload & Parse Resume (PDF/DOCX)
  app.post('/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();
    const filename = data.filename.toLowerCase();

    let extractedText = '';
    if (filename.endsWith('.pdf')) {
      const parsed = await parsePdfBuffer(buffer);
      extractedText = parsed.text;
    } else if (filename.endsWith('.docx')) {
      const parsed = await parseDocxBuffer(buffer);
      extractedText = parsed.text;
    } else {
      extractedText = buffer.toString('utf-8');
    }

    if (!extractedText || extractedText.length < 20) {
      return reply.status(400).send({ error: 'Could not extract text from uploaded document' });
    }

    // AI/Heuristic Structured Extraction
    const structured = await extractStructuredResume(extractedText);

    // Save into Profile & Banks
    let profile = await prisma.profile.findFirst();
    if (!profile) {
      const user = await prisma.user.findFirst();
      if (user) {
        profile = await prisma.profile.create({
          data: { userId: user.id, location: 'Noida, India' },
        });
      }
    }

    if (profile) {
      // 1. Update User name and email if detected
      if (structured.name && structured.name !== 'Candidate') {
        await prisma.user.update({
          where: { id: profile.userId },
          data: {
            name: structured.name,
            email: structured.email || undefined,
          },
        });
      }

      // 2. Update Profile contact info, bio, education, phone
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          phone: structured.phone || profile.phone,
          location: structured.location || profile.location,
          bio: structured.bio || profile.bio,
          education: structured.education.length > 0 ? JSON.stringify(structured.education) : profile.education,
        },
      });

      // 3. Update User target roles preference
      const primaryRole = structured.experiences[0]?.role || (structured.bio && !structured.bio.includes('@') ? structured.bio.slice(0, 35) : 'Software Developer');
      await prisma.userPreference.upsert({
        where: { userId: profile.userId },
        create: {
          userId: profile.userId,
          targetRoles: JSON.stringify([primaryRole]),
          targetLocations: JSON.stringify([structured.location || 'Remote']),
        },
        update: {
          targetRoles: JSON.stringify([primaryRole]),
          targetLocations: structured.location ? JSON.stringify([structured.location, 'Remote']) : undefined,
        },
      });

      // 4. Populate Skills Bank
      for (const skill of structured.skills) {
        const existing = await prisma.skill.findFirst({
          where: { profileId: profile.id, name: skill.name },
        });
        if (!existing) {
          await prisma.skill.create({
            data: {
              profileId: profile.id,
              name: skill.name,
              category: skill.category || 'Technical',
              yearsExperience: skill.yearsExperience,
              verified: true,
            },
          });
        }
      }

      // 5. Populate Experiences Bank
      for (const exp of structured.experiences) {
        const existing = await prisma.experience.findFirst({
          where: { profileId: profile.id, company: exp.company, role: exp.role },
        });
        if (!existing) {
          await prisma.experience.create({
            data: {
              profileId: profile.id,
              company: exp.company,
              role: exp.role,
              employmentType: exp.employmentType,
              location: exp.location,
              startDate: new Date(exp.startDate || '2023-01-01'),
              endDate: exp.endDate ? new Date(exp.endDate) : null,
              isCurrent: exp.isCurrent,
              technologies: JSON.stringify(exp.technologies),
              achievements: {
                create: exp.achievements.map((ach) => ({
                  text: ach.text,
                  metrics: JSON.stringify(ach.metrics),
                  verified: true,
                })),
              },
            },
          });
        }
      }

      // 6. Populate Projects Bank
      for (const proj of structured.projects || []) {
        const existing = await prisma.project.findFirst({
          where: { profileId: profile.id, name: proj.name },
        });
        if (!existing) {
          await prisma.project.create({
            data: {
              profileId: profile.id,
              name: proj.name,
              description: proj.description,
              technologies: JSON.stringify(proj.technologies || []),
              githubUrl: proj.githubUrl || null,
              liveUrl: proj.liveUrl || null,
              measurableResults: JSON.stringify(proj.measurableResults || []),
              verified: true,
            },
          });
        }
      }

      // 7. Create new Version under Master Resume
      let masterResume = await prisma.resume.findFirst({
        where: { profileId: profile.id, isMaster: true },
        include: { versions: { orderBy: { versionNumber: 'desc' } } },
      });

      if (!masterResume) {
        masterResume = await prisma.resume.create({
          data: {
            profileId: profile.id,
            title: 'Master Resume',
            targetRole: primaryRole,
            isMaster: true,
          },
          include: { versions: true },
        });
      }

      const nextVersionNum = (masterResume.versions?.[0]?.versionNumber ?? 0) + 1;
      const newVersion = await prisma.resumeVersion.create({
        data: {
          resumeId: masterResume.id,
          versionNumber: nextVersionNum,
          content: JSON.stringify(structured),
          atsScore: 94,
        },
      });

      return reply.send({
        success: true,
        extracted: structured,
        resumeId: masterResume.id,
        versionId: newVersion.id,
        versionNumber: newVersion.versionNumber,
        profileUpdated: true,
      });
    }

    return reply.send({ success: true, extracted: structured, profileUpdated: false });
  });

  // POST Sync Profile Settings with Selected Resume Version
  app.post('/versions/:versionId/sync-to-profile', async (req: FastifyRequest<{ Params: { versionId: string } }>, reply: FastifyReply) => {
    const { versionId } = req.params;

    const version = await prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: { include: { profile: true } } },
    });

    if (!version) return reply.status(404).send({ error: 'Resume version not found' });

    const c = JSON.parse(version.content || '{}');
    const profileId = version.resume.profileId;

    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: { user: true },
    });
    if (!profile) return reply.status(404).send({ error: 'Profile not found' });

    // Update user name if present
    if (c.fullName && c.fullName !== 'Candidate') {
      await prisma.user.update({
        where: { id: profile.userId },
        data: { name: c.fullName },
      });
    }

    // Update profile
    await prisma.profile.update({
      where: { id: profileId },
      data: {
        phone: c.phone || profile.phone,
        location: c.location || profile.location,
        bio: c.summary || c.bio || profile.bio,
        education: c.education && c.education.length > 0 ? JSON.stringify(c.education) : profile.education,
      },
    });

    // Update target roles
    const role = c.targetRole || (c.experiences?.[0]?.role) || 'Software Engineer';
    await prisma.userPreference.upsert({
      where: { userId: profile.userId },
      create: { userId: profile.userId, targetRoles: JSON.stringify([role]) },
      update: { targetRoles: JSON.stringify([role]) },
    });

    // Add highlighted skills
    if (c.highlightedSkills && Array.isArray(c.highlightedSkills)) {
      for (const group of c.highlightedSkills) {
        for (const skillName of group.skills || []) {
          const existing = await prisma.skill.findFirst({
            where: { profileId, name: skillName },
          });
          if (!existing) {
            await prisma.skill.create({
              data: { profileId, name: skillName, category: group.category || 'Technical', verified: true },
            });
          }
        }
      }
    }

    return reply.send({
      success: true,
      message: `Profile settings successfully synced to Resume Version #${version.versionNumber}`,
      targetRole: role,
    });
  });

  // GET Version Detail with Provenance Sources
  app.get('/versions/:versionId', async (req: FastifyRequest<{ Params: { versionId: string } }>, reply: FastifyReply) => {
    const { versionId } = req.params;

    const version = await prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: {
        resume: true,
        job: { select: { id: true, title: true, company: true, location: true } },
        sources: true,
      },
    });

    if (!version) return reply.status(404).send({ error: 'Resume version not found' });

    return reply.send({
      id: version.id,
      resumeId: version.resumeId,
      resumeTitle: version.resume.title,
      versionNumber: version.versionNumber,
      job: version.job,
      atsScore: version.atsScore,
      atsReport: version.atsReport ? JSON.parse(version.atsReport) : null,
      content: JSON.parse(version.content || '{}'),
      sources: version.sources,
      createdAt: version.createdAt,
    });
  });

  // GET Version Tailored LaTeX Code
  app.get('/versions/:versionId/export-latex', async (req: FastifyRequest<{ Params: { versionId: string } }>, reply: FastifyReply) => {
    const { versionId } = req.params;

    const version = await prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: true, job: true },
    });

    if (!version) return reply.status(404).send({ error: 'Resume version not found' });

    const c = JSON.parse(version.content || '{}');
    const latex = generateTailoredLatex({
      jobTitle: version.job?.title,
      company: version.job?.company,
      summary: c.summary,
    });

    reply.type('text/plain; charset=utf-8').send(latex);
  });

  // GET Version Printable HTML (Prompt Section 15: Preview & Print/PDF)
  app.get('/versions/:versionId/export-html', async (req: FastifyRequest<{ Params: { versionId: string } }>, reply: FastifyReply) => {
    const { versionId } = req.params;

    const version = await prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: true, job: true },
    });

    if (!version) return reply.status(404).send({ error: 'Resume version not found' });

    const c = JSON.parse(version.content || '{}');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${c.fullName || 'Resume'} - ${c.targetRole || 'Software Engineer'}</title>
  <style>
    @page { margin: 15mm; size: A4; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; line-height: 1.45; font-size: 10.5pt; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 18pt; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .contact { font-size: 9pt; color: #444; margin-bottom: 14px; border-bottom: 1.5px solid #222; padding-bottom: 6px; }
    h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin: 12px 0 6px 0; color: #222; }
    .item-header { display: flex; justify-content: space-between; font-weight: bold; font-size: 10pt; margin-top: 6px; }
    .item-sub { display: flex; justify-content: space-between; font-style: italic; font-size: 9.5pt; color: #444; margin-bottom: 4px; }
    ul { margin: 3px 0 6px 18px; padding: 0; }
    li { margin-bottom: 3px; }
    .skills-line { margin: 3px 0; font-size: 9.5pt; }
    .skill-label { font-weight: bold; }
    .badge { font-size: 8pt; background: #eee; padding: 1px 4px; border-radius: 3px; font-weight: normal; color: #555; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px; padding: 10px; background: #f0f4ff; border-radius: 6px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
    <span>Saarthi AI ATS Resume Export &bull; Version #${version.versionNumber} ${version.job ? `&bull; Targeted: ${version.job.title} at ${version.job.company}` : ''}</span>
    <button onclick="window.print()" style="padding: 6px 12px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
  </div>

  <h1>${c.fullName || 'Candidate'}</h1>
  <div class="contact">
    ${[c.email, c.phone, c.location].filter(Boolean).join(' &bull; ')}
  </div>

  ${c.summary ? `
  <h2>Professional Summary</h2>
  <p style="margin: 4px 0 8px 0; font-size: 9.5pt;">${c.summary}</p>
  ` : ''}

  ${c.highlightedSkills && c.highlightedSkills.length > 0 ? `
  <h2>Technical Skills</h2>
  ${c.highlightedSkills.map((g: any) => `
    <div class="skills-line"><span class="skill-label">${g.category}:</span> ${g.skills.join(', ')}</div>
  `).join('')}
  ` : ''}

  ${c.experiences && c.experiences.length > 0 ? `
  <h2>Professional Experience</h2>
  ${c.experiences.map((exp: any) => `
    <div class="item-header">
      <span>${exp.company}</span>
      <span>${exp.location || ''}</span>
    </div>
    <div class="item-sub">
      <span>${exp.role}</span>
      <span>${exp.startDate} &ndash; ${exp.endDate || 'Present'}</span>
    </div>
    <ul>
      ${exp.bullets.map((b: any) => `<li>${b.text}</li>`).join('')}
    </ul>
  `).join('')}
  ` : ''}

  ${c.projects && c.projects.length > 0 ? `
  <h2>Key Engineering Projects</h2>
  ${c.projects.map((proj: any) => `
    <div class="item-header">
      <span>${proj.name}</span>
      <span>${proj.technologies ? proj.technologies.slice(0, 4).join(', ') : ''}</span>
    </div>
    <div style="font-size: 9pt; color: #444; margin-bottom: 3px;">${proj.description}</div>
    <ul>
      ${proj.bullets.map((b: any) => `<li>${b.text}</li>`).join('')}
    </ul>
  `).join('')}
  ` : ''}

  ${c.education && c.education.length > 0 ? `
  <h2>Education</h2>
  ${c.education.map((ed: any) => `
    <div class="item-header">
      <span>${ed.institution}</span>
      <span>${ed.start} &ndash; ${ed.end}</span>
    </div>
    <div class="item-sub">
      <span>${ed.degree} in ${ed.field}</span>
    </div>
  `).join('')}
  ` : ''}
</body>
</html>`;

    reply.type('text/html').send(html);
  });
}
