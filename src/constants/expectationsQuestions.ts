export type ExpectationQuestion = {
  id: string;
  shortLabel: string;
  q: string;
  placeholder: string;
};

export const EXPECTATIONS_QUESTIONS: ExpectationQuestion[] = [
  {
    id: 'q1',
    shortLabel: 'Q1',
    q: 'Please specify the age range you are comfortable with for a potential partner',
    placeholder: 'e.g. max 5 years older or younger than you, or specific age range…',
  },
  {
    id: 'q2',
    shortLabel: 'Q2',
    q: 'Are you open to a partner younger than you?',
    placeholder: 'Can it be a few years younger, or is it a strict no? Any specific age limit?…',
  },
  {
    id: 'q3',
    shortLabel: 'Q3',
    q: 'Height preference for your potential partner?',
    placeholder: 'Should they be taller, shorter, or is height not a concern? Any specific range?…',
  },
  {
    id: 'q4',
    shortLabel: 'Q4',
    q: 'The minimum or preferred education level you would like in a partner?',
    placeholder: 'Bachelor’s degree, Master’s degree, Ph.D, or specific fields of study…',
  },
  {
    id: 'q5',
    shortLabel: 'Q5',
    q: 'Are you open to relocating after marriage? If so, where?',
    placeholder: 'Same city, same country, open worldwide…',
  },
  {
    id: 'q6',
    shortLabel: 'Q6',
    q: 'If you have any general appearance preferences, you may mention them here?',
    placeholder: 'Anything specific you look for in a partner’s appearance, style, or vibe?…',
  },
  {
    id: 'q7',
    shortLabel: 'Q7',
    q: 'If you have any expectations regarding career or financial stability, you may specify them?',
    placeholder: 'Job stability, income level, ambition, or specific career fields…',
  },
  {
    id: 'q8',
    shortLabel: 'Q8',
    q: 'Please share up to three qualities that matter most to you in a life partner',
    placeholder: 'Trustworthiness, sense of humor, family values, or any specific traits you prioritize…',
  },
  {
    id: 'q9',
    shortLabel: 'Q9',
    q: 'Is there anything about your background or lifestyle a partner should know?',
    placeholder: 'Health, dietary choices, cultural expectations…',
  },
  {
    id: 'q10',
    shortLabel: 'Q10',
    q: "What would you like your partner to know about you that a profile can't show?",
    placeholder: 'Anything personal or heartfelt…',
  },
];

export const EXPECTATIONS_QUESTION_MAP = EXPECTATIONS_QUESTIONS.reduce<
  Record<string, ExpectationQuestion>
>((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});