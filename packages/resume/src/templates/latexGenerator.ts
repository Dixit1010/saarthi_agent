export interface LatexResumeParams {
  jobTitle?: string;
  company?: string;
  summary?: string;
  skills?: {
    languages?: string[];
    frontend?: string[];
    backend?: string[];
    cloudTools?: string[];
    coreCs?: string[];
  };
  highlightBullets?: string[];
}

export function generateTailoredLatex(params: LatexResumeParams = {}): string {
  const summary = params.summary || `Full-stack Software Developer with 1+ year of experience in embedded systems, web applications, and AI-integrated products. Proficient in \\textbf{JavaScript, TypeScript, Python, C, C++, C\\#}, and frameworks including \\textbf{React.js, Next.js, Node.js, Express.js, and .NET}. Selected in the top \\textbf{0.5\\% of 80,000+} applicants for Amazon ML Summer School 2024.`;

  return `\\documentclass[letterpaper,10pt]{article}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage{tabularx}
\\usepackage{times}
\\usepackage{mathptmx}
\\input{glyphtounicode}
\\pdfgentounicode=1

\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\addtolength{\\oddsidemargin}{-0.6in}
\\addtolength{\\textwidth}{1.19in}
\\addtolength{\\topmargin}{-.7in}
\\addtolength{\\textheight}{1.4in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\large\\raggedright\\bfseries}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-2pt}}}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{1.0\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & \\textbf{\\small #2} \\\\
      \\textit{\\small #3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-5pt}
}
\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{1.0\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small #1 & \\small #2 \\\\
    \\end{tabular*}\\vspace{-5pt}
}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[leftmargin=*, label=\\textbullet]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}

%==========================================================
\\begin{document}

%-----------HEADER-----------
\\begin{center}
  {\\Huge \\scshape Dixit Kumar} \\\\ \\vspace{1pt}
  Dwarka, Delhi \\\\
  \\small
  \\href{mailto:dixitkumar300@gmail.com}{\\underline{dixitkumar300@gmail.com}} ~|~
  +91 7060137673 ~|~
  \\href{https://linkedin.com/in/dixit-kumar-ba321a164}{\\underline{linkedin.com/in/dixitkum}} ~|~
  \\href{https://github.com/Dixit1010}{\\underline{github.com/Dixit1010}} ~|~
  Portfolio: \\href{https://portfoliodixitt.netlify.app/}{\\underline{portfoliodixitt.netlify.app}}
  \\vspace{-8pt}
\\end{center}

%-----------SUMMARY-----------
\\section{Professional Summary}
\\small{${summary}}
\\vspace{-2pt}

%-----------EDUCATION-----------
\\section{Education}
\\resumeSubHeadingListStart
  \\resumeSubheading
    {Netaji Subhas University of Technology (NSUT)}{Aug 2021 -- May 2025}
    {B.Tech in Electronics and Communication Engineering}{Delhi, India}
    \\resumeItemListStart
      \\resumeItem{CGPA: 7.3/10 $|$ Relevant Coursework: OS, DBMS, Computer Networks, Software Engineering, Data Structures \\& Algorithms}
    \\resumeItemListEnd
\\resumeSubHeadingListEnd

%-----------EXPERIENCE-----------
\\section{Experience}
\\resumeSubHeadingListStart

  \\resumeSubheading
    {Software Developer}{Jan 2025 -- Present}
    {KIMBAL}{Noida, India}
    \\resumeItemListStart
      \\resumeItem{Refactored \\textbf{10,000+ lines} of embedded \\textbf{C middleware} for RL78/I1C smart meters, reducing memory footprint by \\textbf{25\\%} and raising packet reliability from \\textbf{60\\% to 95\\%} via logic analyzer debugging.}
      \\resumeItem{Built a \\textbf{Windows desktop automation framework} using \\textbf{C\\# .NET, WPF, and MVVM} for RF/4G module testing with custom binary protocol parsers, factory pattern handlers, and \\textbf{REST APIs} with Swagger, automating \\textbf{8 critical test sequences}.}
      \\resumeItem{Developed \\textbf{Python CLI tools} and \\textbf{bash scripts} to automate UART data extraction, serial testing, and firmware deployment, reducing manual QA effort by \\textbf{66\\%} and boosting throughput by \\textbf{3x}.}
      \\resumeItem{Engineered a real-time \\textbf{optical pulse decoding system} integrated with internal \\textbf{ML labeling pipelines}, increasing data processing throughput by \\textbf{2x} for model training.}
    \\resumeItemListEnd

  \\resumeSubheading
    {Mentee -- Applied Machine Learning Program}{Jun 2024 -- Aug 2024}
    {Amazon ML Summer School}{Remote}
    \\resumeItemListStart
      \\resumeItem{Selected among top \\textbf{0.5\\% of 80,000+} applicants; completed \\textbf{120+ hours} of training in supervised/unsupervised learning, model evaluation, and cloud deployment; built \\textbf{5 end-to-end ML projects} using Python, Scikit-learn, and Pandas.}
      \\resumeItem{Deployed ML models via \\textbf{Flask APIs} on \\textbf{AWS SageMaker} for real-time inference; collaborated with 30+ mentees on capstone projects using Git and Jupyter notebooks.}
    \\resumeItemListEnd

\\resumeSubHeadingListEnd

%-----------PROJECTS-----------
\\section{Projects}
\\resumeSubHeadingListStart

  \\resumeProjectHeading
    {\\textbf{TravPlan} -- AI Travel Planner $|$ \\emph{React 18, Tailwind CSS, Firebase, Gemini AI, Framer Motion}}
    {2026 \\hfill \\href{https://travplann.netlify.app/}{\\underline{Live}} ~|~ \\href{https://github.com/Dixit1010/Trav_Plan}{\\underline{GitHub}}}
    \\resumeItemListStart
      \\resumeItem{Built a full-stack \\textbf{AI travel planner} using \\textbf{Google Gemini 2.0 API} generating personalized itineraries and hotel picks for \\textbf{50+ destinations} in under \\textbf{30 seconds}; integrated \\textbf{Firebase Auth (OAuth 2.0)} and \\textbf{Firestore} for secure sign-in and real-time trip storage.}
      \\resumeItem{Designed a \\textbf{mobile-first} responsive UI with \\textbf{Framer Motion} animations and implemented a production-grade \\textbf{exponential backoff retry system} (3 attempts, 30--90s intervals) to handle API rate limits gracefully.}
      \\resumeItem{Optimized app performance with \\textbf{lazy loading}, \\textbf{code splitting}, and \\textbf{memoization}, reducing initial load time by \\textbf{40\\%} and improving Lighthouse performance score to \\textbf{90+}.}
    \\resumeItemListEnd

  \\resumeProjectHeading
    {\\textbf{Hirexx} -- Full-Stack Job Portal $|$ \\emph{Next.js 16, TypeScript, Node.js, Express.js, MongoDB, Tailwind CSS}}
    {2026 \\hfill \\href{https://hirexx.vercel.app/}{\\underline{Live}} ~|~ \\href{https://github.com/Dixit1010/job_portal}{\\underline{GitHub}}}
    \\resumeItemListStart
      \\resumeItem{Developed a \\textbf{production-grade} job portal with \\textbf{Role-Based Access Control (RBAC)}, real-time job search, application tracking, \\textbf{JWT authentication}, \\textbf{bcrypt}-encrypted credentials, and \\textbf{OAuth 2.0} social login via Clerk -- deployed on \\textbf{Vercel} and \\textbf{Render}.}
      \\resumeItem{Architected a scalable \\textbf{REST API} with \\textbf{Express.js}, \\textbf{Zod schema validation}, centralized error handling, \\textbf{XSS protection}, rate limiting, and \\textbf{MongoDB sanitization} across \\textbf{10+ endpoints}.}
      \\resumeItem{Integrated \\textbf{Cloudinary} for resume and media uploads with file type validation; implemented \\textbf{TanStack React Query} for server-state caching, reducing redundant API calls by \\textbf{35\\%} and improving UI responsiveness.}
    \\resumeItemListEnd

  \\resumeProjectHeading
    {\\textbf{Chatify} -- Real-Time Chat App $|$ \\emph{MERN Stack, Socket.IO, Tailwind CSS}}
    {Jul 2024 \\hfill \\href{https://chat-app-full-stack-h5ys.onrender.com/login}{\\underline{Live}} ~|~ \\href{https://github.com/Dixit1010/chat-app_full_stack.git}{\\underline{GitHub}}}
    \\resumeItemListStart
      \\resumeItem{Built a scalable \\textbf{real-time chat app} with 1:1 and group messaging using \\textbf{Socket.IO} and \\textbf{WebSocket communication}; implemented \\textbf{JWT} auth, typing indicators, online presence, and push notifications.}
      \\resumeItem{Designed a responsive \\textbf{React} UI achieving \\textbf{sub-100ms latency} and supporting \\textbf{500+ concurrent users} in load-tested environments.}
    \\resumeItemListEnd

\\resumeSubHeadingListEnd

%-----------TECHNICAL SKILLS-----------
\\section{Technical Skills}
\\begin{itemize}[leftmargin=0.15in, label={}]
  \\small{\\item{
    \\textbf{Languages:} Python, JavaScript, TypeScript, C, C++, C\\# \\\\
    \\textbf{Frontend:} React.js, Next.js, Tailwind CSS, Framer Motion, TanStack React Query, WPF, MVVM \\\\
    \\textbf{Backend \\& DB:} Node.js, Express.js, Flask, .NET, REST APIs, JWT, Zod, Mongoose, MongoDB, SQL, Socket.IO \\\\
    \\textbf{Cloud \\& Tools:} AWS SageMaker, Vercel, Render, Firebase, Cloudinary, Git, GitHub, Postman, Swagger \\\\
    \\textbf{Core CS:} Data Structures \\& Algorithms, OOP, SOLID Principles, System Design, OS, DBMS, Computer Networks
  }}
\\end{itemize}

%-----------ACHIEVEMENTS-----------
\\section{Achievements}
\\resumeItemListStart
  \\resumeItem{Selected in the \\textbf{top 0.5\\%} of \\textbf{80,000+} applicants for \\textbf{Amazon ML Summer School 2024}.}
  \\resumeItem{Solved \\textbf{850+ LeetCode} problems, rated \\textbf{1600+ on CodeChef (3-star)}, and \\textbf{300+ GFG} DSA problems.}
\\resumeItemListEnd

\\end{document}
`;
}
