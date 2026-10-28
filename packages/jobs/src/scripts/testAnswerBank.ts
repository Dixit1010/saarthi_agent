import {
  resolveQuestionAnswer,
  DIXIT_ANSWER_BANK,
  APPLICATION_ACCURACY_RULES,
  detectEngineeringDomain,
  calculateDateBasedExperience,
} from '../answers/answerBank.js';
import { generateApplicationAnswers } from '../answers/answerEngine.js';

async function runTests() {
  console.log('=== DIXIT KUMAR ANSWER BANK VERIFICATION ===\n');

  // Test 1: Check canonical count
  console.log(`[Test 1] Canonical Q&A Count: ${DIXIT_ANSWER_BANK.length} (Expected: 20)`);
  if (DIXIT_ANSWER_BANK.length !== 20) {
    throw new Error(`Expected 20 questions, got ${DIXIT_ANSWER_BANK.length}`);
  }
  console.log('✅ Canonical count verified.\n');

  // Test 2: Check Accuracy Rules
  console.log(`[Test 2] Application Accuracy Rules Count: ${APPLICATION_ACCURACY_RULES.length} (Expected: 8)`);
  if (APPLICATION_ACCURACY_RULES.length !== 8) {
    throw new Error(`Expected 8 accuracy rules, got ${APPLICATION_ACCURACY_RULES.length}`);
  }
  console.log('✅ Accuracy rules count verified.\n');

  // Test 3: Domain Detection
  console.log('[Test 3] Testing Domain Detection:');
  const d1 = detectEngineeringDomain('Embedded Firmware Engineer', 'Microcontroller C programming');
  const d2 = detectEngineeringDomain('C++ Systems Developer', 'Low latency Linux POSIX');
  const d3 = detectEngineeringDomain('Backend Engineer', 'Node.js Express REST API');
  const d4 = detectEngineeringDomain('Full Stack Developer', 'React Next.js TypeScript');
  const d5 = detectEngineeringDomain('AI Engineer', 'Python LLM LangChain');
  console.log(`- Embedded: ${d1} (expected: embedded)`);
  console.log(`- C++ Systems: ${d2} (expected: cpp_systems)`);
  console.log(`- Backend: ${d3} (expected: backend)`);
  console.log(`- Full Stack: ${d4} (expected: full_stack)`);
  console.log(`- AI: ${d5} (expected: ai)`);
  if (d1 !== 'embedded' || d2 !== 'cpp_systems' || d3 !== 'backend' || d4 !== 'full_stack' || d5 !== 'ai') {
    throw new Error('Domain detection mismatch');
  }
  console.log('✅ Domain detection verified.\n');

  // Test 4: Role-tailored Answers for Relevant Project (Q8)
  console.log('[Test 4] Testing Role Tailoring for Relevant Project (Q8):');
  const projEmbedded = resolveQuestionAnswer('Tell me about your most relevant project', {
    jobTitle: 'Embedded Firmware Engineer',
  });
  console.log(`- Embedded project response contains Kimbal RL78/I1C: ${projEmbedded.answer.includes('Kimbal') && projEmbedded.answer.includes('RL78/I1C')}`);
  if (!projEmbedded.answer.includes('Kimbal') || !projEmbedded.answer.includes('RL78/I1C')) {
    throw new Error('Embedded role did not tailor to Kimbal RL78/I1C');
  }

  const projBackend = resolveQuestionAnswer('Tell me about your most relevant project', {
    jobTitle: 'Backend Engineer',
  });
  console.log(`- Backend project response contains Hirexx: ${projBackend.answer.includes('Hirexx')}`);
  if (!projBackend.answer.includes('Hirexx')) {
    throw new Error('Backend role did not tailor to Hirexx');
  }

  const projAI = resolveQuestionAnswer('Tell me about your most relevant project', {
    jobTitle: 'AI Application Engineer',
  });
  console.log(`- AI project response contains TravPlan & Amazon ML: ${projAI.answer.includes('TravPlan')}`);
  if (!projAI.answer.includes('TravPlan')) {
    throw new Error('AI role did not tailor to TravPlan');
  }
  console.log('✅ Role-tailored project responses verified.\n');

  // Test 5: Agent Rule #11 - Current CTC Guard
  console.log('[Test 5] Testing Agent Rule #11 (Current CTC Confirmation Guard):');
  const currentCtcNoConfirm = resolveQuestionAnswer('What is your current CTC?');
  console.log(`- requiresReview: ${currentCtcNoConfirm.requiresReview} (expected: true)`);
  console.log(`- Review reason: "${currentCtcNoConfirm.reviewReason}"`);
  if (!currentCtcNoConfirm.requiresReview || !currentCtcNoConfirm.reviewReason?.includes('Current CTC requires explicit confirmation')) {
    throw new Error('Current CTC guard failed to flag review');
  }

  const currentCtcConfirmed = resolveQuestionAnswer('What is your current CTC?', {
    confirmedCurrentCtc: '₹12.5 LPA',
  });
  console.log(`- When confirmed: "${currentCtcConfirmed.answer}", requiresReview: ${currentCtcConfirmed.requiresReview} (expected: false)`);
  if (currentCtcConfirmed.requiresReview || currentCtcConfirmed.answer !== '₹12.5 LPA') {
    throw new Error('Confirmed Current CTC failed');
  }
  console.log('✅ Agent Rule #11 verified.\n');

  // Test 6: Agent Rule #10 - Expected Salary
  console.log('[Test 6] Testing Agent Rule #10 (Expected Salary ₹18 LPA):');
  const salaryAns = resolveQuestionAnswer('What are your salary expectations?');
  console.log(`- Expected salary answer contains ₹18 LPA: ${salaryAns.answer.includes('₹18 LPA')}`);
  if (!salaryAns.answer.includes('₹18 LPA')) {
    throw new Error('Expected salary did not report ₹18 LPA');
  }
  console.log('✅ Agent Rule #10 verified.\n');

  // Test 7: Agent Rule #12 - Notice Period & Immediate Joiner Guard
  console.log('[Test 7] Testing Agent Rule #12 (Notice Period & Immediate Joiner Guard):');
  const noticeAns = resolveQuestionAnswer('What is your notice period?');
  console.log(`- Stated notice period: "${noticeAns.answer}"`);
  if (!noticeAns.answer.includes('15 days or less')) {
    throw new Error('Notice period did not state 15 days or less');
  }

  const immediateGuard = resolveQuestionAnswer('Can you join immediately (0 days notice)?');
  console.log(`- Immediate joiner requiresReview: ${immediateGuard.requiresReview} (expected: true)`);
  if (!immediateGuard.requiresReview) {
    throw new Error('Immediate joiner query did not trigger review guard');
  }
  console.log('✅ Agent Rule #12 verified.\n');

  // Test 8: Customization Rule for Q3 (Why join Company?)
  console.log('[Test 8] Testing Customization Rule for Why Join Company (Q3):');
  const whyCisco = resolveQuestionAnswer('Why do you want to join our company?', {
    company: 'Cisco Systems',
    jobTitle: 'Software Engineer - Networking Protocols',
  });
  console.log(`- Personalized answer mentions "Cisco Systems": ${whyCisco.answer.includes('Cisco Systems')}`);
  console.log(`- Personalized answer mentions role: ${whyCisco.answer.includes('Software Engineer - Networking Protocols')}`);
  if (!whyCisco.answer.includes('Cisco Systems')) {
    throw new Error('Company personalization failed');
  }
  console.log('✅ Customization Rule Q3 verified.\n');

  // Test 9: End-to-End Application Answer Generator
  console.log('[Test 9] Testing generateApplicationAnswers engine:');
  const answers = await generateApplicationAnswers({
    job: {
      id: 'job-123',
      title: 'Firmware Engineer I',
      company: 'Texas Instruments',
      description: 'Microcontroller firmware development in embedded C/C++.',
    },
    candidate: {
      name: 'Dixit Kumar',
      email: 'dixitkumar300@gmail.com',
      experienceYears: 1.8,
      expectedSalary: '₹18 LPA',
      noticePeriodDays: 15,
      location: 'Noida, India',
      experiences: [],
      projects: [],
      skills: [{ name: 'Embedded C' }, { name: 'C++' }, { name: 'RTOS' }],
    },
    customQuestions: [
      'Describe a challenging technical problem you solved',
      'What are your strengths?',
      'What is your weakness?',
      'Describe a time you improved a process',
    ],
  });

  console.log(`- Total answers generated: ${answers.length}`);
  answers.forEach((a, idx) => {
    console.log(`  [${idx + 1}] (${a.category}) ${a.question} -> Review: ${a.requiresReview}`);
  });

  const expAnswer = answers.find((a) => a.question.includes('experience'));
  if (!expAnswer?.answer.includes('1.8 years')) {
    throw new Error('Experience answer did not state 1.8 years');
  }
  console.log('✅ End-to-end answer generator verified.\n');

  // Test 10: Date-based Experience Calculation
  console.log('[Test 10] Testing Date-based Experience Helper:');
  const dateExp = calculateDateBasedExperience('2024-02-01');
  console.log(`- Calculated experience: ${dateExp.totalYearsText} (${dateExp.totalMonths} months)`);
  if (dateExp.totalMonths < 18) {
    throw new Error('Calculated date-based experience unexpectedly low');
  }
  console.log('✅ Date-based experience calculation verified.\n');

  console.log('🎉 ALL 10 TEST SUITES PASSED FLAWLESSLY!');
}

runTests().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
