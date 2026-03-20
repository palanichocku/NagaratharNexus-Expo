// Run: npm run seed:test-users -- --count 200
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import * as AppData from '../src/constants/appData';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STANDARD_TEST_PASSWORD = 'W0rld@2026';

type SeedState = {
  is_submitted: boolean;
  is_approved: boolean;
  state_label: 'APPROVED' | 'PENDING_APPROVAL' | 'DRAFT';
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMany<T>(arr: T[] | undefined, countN: number): T[] {
  const src = [...(arr || [])];
  const out: T[] = [];
  while (src.length > 0 && out.length < countN) {
    const idx = Math.floor(Math.random() * src.length);
    out.push(src[idx]);
    src.splice(idx, 1);
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getRandomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().slice(0, 10);
}

function parseCount(): number {
  const idx = process.argv.findIndex((x) => x === '--count');
  const raw = idx >= 0 ? process.argv[idx + 1] : undefined;
  const n = Number(raw || 0);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Pass a valid --count value, e.g. --count 200');
  }
  return n;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const pickKovil = () => {
  const kovil = AppData.KOVIL_DATA[Math.floor(Math.random() * AppData.KOVIL_DATA.length)];
  const pirivu =
    kovil.pirivus && kovil.pirivus.length > 0
      ? kovil.pirivus[Math.floor(Math.random() * kovil.pirivus.length)]
      : 'None';

  return { kovil: kovil.value, pirivu };
};

function buildExactStatePlan(count: number): SeedState[] {
  const approvedCount = Math.floor(count * 0.7);
  const pendingCount = Math.floor(count * 0.2);
  const draftCount = count - approvedCount - pendingCount;

  const states: SeedState[] = [];

  for (let i = 0; i < approvedCount; i++) {
    states.push({
      is_submitted: true,
      is_approved: true,
      state_label: 'APPROVED',
    });
  }

  for (let i = 0; i < pendingCount; i++) {
    states.push({
      is_submitted: true,
      is_approved: false,
      state_label: 'PENDING_APPROVAL',
    });
  }

  for (let i = 0; i < draftCount; i++) {
    states.push({
      is_submitted: false,
      is_approved: false,
      state_label: 'DRAFT',
    });
  }

  return shuffle(states);
}

const CANNED_EXPECTATION_ANSWERS: Array<Record<string, string>> = [
  {
    q1: 'Comfortable with a partner who is 2 to 4 years older or younger.',
    q2: 'Yes, open to a partner up to 2 years younger if compatibility is strong.',
    q3: 'Height is not a major factor, but a moderate and proportionate height is preferred.',
    q4: 'Bachelor’s degree minimum. Master’s degree or professional qualification is a plus.',
    q5: 'Open to relocating within India or abroad depending on family and career alignment.',
    q6: 'Simple, neat, and pleasant appearance preferred. Nothing overly specific beyond that.',
    q7: 'Would value a stable career, financial responsibility, and a practical mindset.',
    q8: 'Kindness, family values, and emotional maturity.',
    q9: 'Traditional family background with a balanced modern outlook and respect for elders.',
    q10: 'I value calm communication, loyalty, and building a steady family life together.',
  },
  {
    q1: 'Preferred age range is within 3 years older or 2 years younger.',
    q2: 'Yes, a slightly younger partner is fine if values and goals match.',
    q3: 'Would prefer someone around the same height or taller, but not strict.',
    q4: 'Graduate degree preferred, especially someone who values learning and growth.',
    q5: 'Open to relocation, especially to major cities in India, the US, or Singapore.',
    q6: 'Looking for someone with a warm smile, simple style, and confident presence.',
    q7: 'A stable profession and sensible money habits are more important than income level.',
    q8: 'Honesty, respectfulness, and adaptability.',
    q9: 'Close-knit family setup and preference for a partner who is comfortable with family involvement.',
    q10: 'I am thoughtful and dependable, and I value depth over showiness in relationships.',
  },
  {
    q1: 'Comfortable with a partner in the range of 25 to 31.',
    q2: 'Yes, open to a younger partner within a reasonable age gap.',
    q3: 'Height is flexible. Personality and compatibility matter much more.',
    q4: 'At least a bachelor’s degree. Open to any strong educational background.',
    q5: 'Willing to relocate if the decision makes sense for both families and careers.',
    q6: 'No rigid appearance expectations, but presentable and well-groomed is appreciated.',
    q7: 'Would like a partner who is ambitious, stable, and has a responsible outlook.',
    q8: 'Trustworthiness, patience, and kindness.',
    q9: 'Prefer a healthy lifestyle, vegetarian-friendly environment, and grounded family values.',
    q10: 'I am committed, sincere, and serious about building a warm and respectful marriage.',
  },
  {
    q1: 'Open to a partner within 4 years older or 3 years younger.',
    q2: 'Yes, younger is okay if maturity and compatibility are there.',
    q3: 'Prefer someone slightly taller, but this is not a hard requirement.',
    q4: 'Bachelor’s or above. A practical and thoughtful mindset matters too.',
    q5: 'Open to relocating anywhere that offers a good support system and stability.',
    q6: 'A natural, modest, and approachable personality is attractive.',
    q7: 'Would like someone with a steady career path and financial discipline.',
    q8: 'Compassion, reliability, and good communication.',
    q9: 'Family traditions matter, but so does mutual respect and flexibility in married life.',
    q10: 'I bring sincerity, emotional steadiness, and a genuine wish to grow together as partners.',
  },
  {
    q1: 'Preferred age difference is plus or minus 3 years.',
    q2: 'Yes, open to a younger partner if the match feels right overall.',
    q3: 'No strong preference. A healthy and confident presence is enough.',
    q4: 'Well-educated partner preferred, ideally graduate or post-graduate.',
    q5: 'Open to relocating within the same country or internationally after discussion.',
    q6: 'Prefer simple elegance and a naturally pleasant personality.',
    q7: 'Career seriousness and financial maturity are important expectations.',
    q8: 'Loyalty, empathy, and family orientation.',
    q9: 'Would like a partner who is respectful of both tradition and individuality.',
    q10: 'I am calm, understanding, and value quiet consistency more than dramatic gestures.',
  },
  {
    q1: 'Comfortable with a partner around 24 to 30 years of age.',
    q2: 'Yes, a partner a couple of years younger is acceptable.',
    q3: 'Flexible on height. Compatibility matters more than numbers.',
    q4: 'Minimum bachelor’s degree, preferably someone who is intellectually curious.',
    q5: 'Relocation is possible depending on work, family needs, and comfort level.',
    q6: 'Clean, composed, and positive personality preferred over any specific look.',
    q7: 'Would appreciate a partner with long-term financial thinking and work ethic.',
    q8: 'Humility, sincerity, and emotional intelligence.',
    q9: 'Simple lifestyle, family-centered mindset, and preference for a peaceful home environment.',
    q10: 'I value sincerity, shared responsibility, and mutual encouragement in married life.',
  },
  {
    q1: 'Open to a partner within about 5 years older or 2 years younger.',
    q2: 'Yes, open to a younger partner if values align.',
    q3: 'Would prefer average to tall height, though this is not a deal-breaker.',
    q4: 'Graduate education preferred; professional qualifications are a plus.',
    q5: 'Open to moving to another city or country if the long-term plan is strong.',
    q6: 'Natural appearance, confidence, and respectful demeanor are most attractive.',
    q7: 'Would prefer someone stable, career-focused, and financially sensible.',
    q8: 'Respect, maturity, and kindness.',
    q9: 'Partner should know that family harmony and mutual respect are very important to me.',
    q10: 'I may appear reserved initially, but I am deeply committed and supportive once I trust someone.',
  },
  {
    q1: 'Preferred age range is roughly 25 to 32.',
    q2: 'Yes, slightly younger is acceptable in the right match.',
    q3: 'No strict preference on height, just a generally good match in personality and outlook.',
    q4: 'At least a bachelor’s degree and a willingness to keep growing in life.',
    q5: 'Open to relocation after marriage if it supports family and future plans.',
    q6: 'No specific appearance expectation other than being neat, pleasant, and confident.',
    q7: 'A stable career and a mature view of finances are important.',
    q8: 'Understanding, honesty, and stability.',
    q9: 'I prefer balanced living, respect for family values, and openness in communication.',
    q10: 'I care deeply about building a peaceful, trusting partnership that lasts.',
  },
  {
    q1: 'Comfortable with a partner within an age gap of 3 to 5 years.',
    q2: 'Yes, open to younger if maturity level is good.',
    q3: 'Height is secondary. Character and compatibility come first.',
    q4: 'A good educational foundation is important, ideally graduate level or above.',
    q5: 'Relocation can be considered with mutual understanding and planning.',
    q6: 'Would prefer someone who carries themselves with simplicity and grace.',
    q7: 'Expect a partner to be responsible, hardworking, and financially aware.',
    q8: 'Dependability, warmth, and family-mindedness.',
    q9: 'I appreciate a respectful lifestyle, cultural awareness, and emotional steadiness.',
    q10: 'I am serious about commitment and value shared effort in building a happy married life.',
  },
  {
    q1: 'Preferred age range is 24 to 29, with some flexibility for the right person.',
    q2: 'Yes, open to a younger partner within a small age gap.',
    q3: 'No rigid height expectation. A comfortable overall match is enough.',
    q4: 'Bachelor’s minimum; advanced education is welcome but not mandatory.',
    q5: 'Open to relocating nationally or internationally after careful discussion.',
    q6: 'Looking for a composed, well-presented, and naturally kind person.',
    q7: 'Would like a partner who is steady, responsible, and realistic about finances.',
    q8: 'Patience, honesty, and respect for relationships.',
    q9: 'I prefer simple living, family respect, and a partner who values emotional steadiness.',
    q10: 'Beyond my profile, I would want my partner to know that I value trust and quiet consistency very deeply.',
  },
];

function buildExpectationText(globalIndex: number): string {
  const a = CANNED_EXPECTATION_ANSWERS[globalIndex % CANNED_EXPECTATION_ANSWERS.length];

  return [
    'Partner Expectations Questionnaire',
    '',
    'Q1. Please specify the age range you are comfortable with for a potential partner',
    `A. ${a.q1}`,
    '',
    'Q2. Are you open to a partner younger than you?',
    `A. ${a.q2}`,
    '',
    'Q3. Height preference for your potential partner?',
    `A. ${a.q3}`,
    '',
    'Q4. The minimum or preferred education level you would like in a partner?',
    `A. ${a.q4}`,
    '',
    'Q5. Are you open to relocating after marriage? If so, where?',
    `A. ${a.q5}`,
    '',
    'Q6. If you have any general appearance preferences, you may mention them here?',
    `A. ${a.q6}`,
    '',
    'Q7. If you have any expectations regarding career or financial stability, you may specify them?',
    `A. ${a.q7}`,
    '',
    'Q8. Please share up to three qualities that matter most to you in a life partner',
    `A. ${a.q8}`,
    '',
    'Q9. Is there anything about your background or lifestyle a partner should know?',
    `A. ${a.q9}`,
    '',
    "Q10. What would you like your partner to know about you that a profile can't show?",
    `A. ${a.q10}`,
  ].join('\n');
}

async function generateTestUsers(count: number) {
  const CHUNK_SIZE = 250;
  const totalChunks = Math.ceil(count / CHUNK_SIZE);
  const statePlan = buildExactStatePlan(count);

  const plannedApproved = statePlan.filter((s) => s.state_label === 'APPROVED').length;
  const plannedPending = statePlan.filter((s) => s.state_label === 'PENDING_APPROVAL').length;
  const plannedDraft = statePlan.filter((s) => s.state_label === 'DRAFT').length;

  console.log(`⚡ starting Turbo Generation: ${count} users in ${totalChunks} chunks.`);
  console.log(`🔐 Standard test password: ${STANDARD_TEST_PASSWORD}`);
  console.log(
    `📊 Exact state mix: approved=${plannedApproved}, pending=${plannedPending}, draft=${plannedDraft}`
  );

  const asString = (v: any) => (v == null ? '' : String(v));

  const pickValue = (arr: any[]) => {
    const v = pick(arr);
    if (v && typeof v === 'object') return asString(v.value ?? v.label ?? '');
    return asString(v);
  };

  const pickManyValues = (arr: any[] | undefined, countN: number) => {
    const xs = pickMany(arr, countN);
    return (xs || [])
      .map((v: any) => {
        if (v && typeof v === 'object') return asString(v.value ?? v.label ?? '');
        return asString(v);
      })
      .filter((s: string) => s.trim().length > 0);
  };

  const interestsSource = (AppData.INTEREST_DATA || (AppData as any).INTERESTS_DATA) as any[];

  let created = 0;
  let failed = 0;
  let approvedCount = 0;
  let pendingCount = 0;
  let draftCount = 0;

  for (let c = 0; c < totalChunks; c++) {
    try {
      const batchProfiles: any[] = [];
      const createdAuthUserIds: string[] = [];
      const currentBatchSize = Math.min(CHUNK_SIZE, count - c * CHUNK_SIZE);

      for (let i = 0; i < currentBatchSize; i++) {
        const globalIndex = c * CHUNK_SIZE + i;
        const status = statePlan[globalIndex];
        const kData = pickKovil();

        const gender = pickValue(AppData.GENDER_DATA);
        const seq = globalIndex + 1;
        const memberName = `member${seq}`;
        const nexusName = `nexus${seq}`;
        const fullName = `${memberName} ${nexusName}`;
        const email = `${memberName}@nexus.com`;

        const makeEdu = () => ({
          level: pickValue(AppData.EDUCATION_DATA),
          field: pickValue(AppData.FIELD_OF_STUDY_DATA),
          university: pickValue((AppData as any).UNIVERSITY_DATA || ['Anna University', 'IIT', 'BITS']),
        });

        const heightText = pickValue(AppData.HEIGHT_DATA);
        const residentCountry = pickValue(AppData.RESIDENT_COUNTRY_DATA);
        const citizenship = pickValue(AppData.RESIDENT_COUNTRY_DATA);
        const dob = getRandomDate(new Date(1985, 0, 1), new Date(2000, 11, 31));

        const password = STANDARD_TEST_PASSWORD;

        const MALE_SEED_PHOTOS = [
          `${supabaseUrl}/storage/v1/object/public/seed-photos/male-1.jpg`,
          `${supabaseUrl}/storage/v1/object/public/seed-photos/male-2.jpg`,
          `${supabaseUrl}/storage/v1/object/public/seed-photos/male-3.jpg`,
        ];

        const FEMALE_SEED_PHOTOS = [
          `${supabaseUrl}/storage/v1/object/public/seed-photos/female-1.jpg`,
          `${supabaseUrl}/storage/v1/object/public/seed-photos/female-2.jpg`,
          `${supabaseUrl}/storage/v1/object/public/seed-photos/female-3.jpg`,
        ];

        function pickSeedPhotoUrl(gender: string): string {
          const g = String(gender || '').trim().toUpperCase();
          if (g === 'FEMALE') return pick(FEMALE_SEED_PHOTOS);
          return pick(MALE_SEED_PHOTOS);
        }

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            is_test_data: true,
            generator: 'scripts/generate-test-users',
            seeded_state: status.state_label,
          },
        });

        if (authError || !authData?.user?.id) {
          throw new Error(`Auth create failed for ${email}: ${authError?.message || 'unknown error'}`);
        }

        const userId = authData.user.id;
        createdAuthUserIds.push(userId);

        if (status.state_label === 'APPROVED') approvedCount += 1;
        else if (status.state_label === 'PENDING_APPROVAL') pendingCount += 1;
        else draftCount += 1;

        batchProfiles.push({
          id: userId,
          is_test_data: true,
          is_approved: status.is_approved,
          is_submitted: status.is_submitted,
          role: 'USER',

          full_name: fullName,
          dob,
          gender,
          email,
          phone: `+91 900000000${i % 10}`,

          citizenship,
          resident_country: residentCountry,
          resident_status: pickValue(AppData.RESIDENT_STATUS_DATA),
          current_state: pick(['Tamil Nadu', 'California', 'Ontario', 'London']),
          current_city: pick(['Chennai', 'San Francisco', 'Toronto', 'Coimbatore']),
          native_place: (() => {
            const v = pick(AppData.NATIVE_PLACES_DATA);
            return v && typeof v === 'object' ? asString(v.value ?? v.label ?? '') : asString(v);
          })(),

          kovil: asString(kData.kovil),
          pirivu: asString(kData.pirivu),
          rasi: (() => {
            const v = pick(AppData.RASI_DATA);
            return v && typeof v === 'object' ? asString(v.value ?? v.label ?? '') : asString(v);
          })(),
          star: (() => {
            const v = pick(AppData.NAKSHATRA_DATA);
            return v && typeof v === 'object' ? asString(v.value ?? v.label ?? '') : asString(v);
          })(),

          marital_status: pickValue(AppData.MARITAL_STATUS_DATA),
          height: heightText,
          profession: pickValue(AppData.PROFESSION_DATA),
          workplace: pick(['TCS', 'Google', 'Apollo Hospital', 'Self-Employed']),
          linkedin_profile: 'https://linkedin.com/in/testuser',

          interests: pickManyValues(interestsSource, 5),
          siblings: [pick(['Brother', 'Sister'])],

          family_initials: pickValue(AppData.FAMILY_INITIALS_DATA),
          father_name: `Father of ${memberName}`,
          father_work: 'Business',
          father_phone: '+11234567890',
          mother_name: `Mother of ${memberName}`,
          mother_work: 'Home Maker',
          mother_phone: '+11234567890',

          family_details: {
            siblings: [
              {
                name: `${memberName}'s sibling`,
                maritalStatus: 'Married',
                occupation: pickValue(AppData.OCCUPATION_DATA),
              },
            ],
          },

          education_history: [makeEdu(), makeEdu()],
          expectations: buildExpectationText(globalIndex),

          hide_phone: false,
          hide_email: false,
          profile_photo_url: Math.random() < 0.8 ? pickSeedPhotoUrl(gender) : '',

          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      const { error: profileError } = await supabaseAdmin.from('profiles').insert(batchProfiles);

      if (profileError) {
        for (const userId of createdAuthUserIds) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(userId);
          } catch {}
        }
        throw new Error(profileError.message);
      }

      const roleRows = batchProfiles.map((p) => ({
        user_id: p.id,
        role: 'USER',
      }));

      const { error: roleError } = await supabaseAdmin.from('user_roles').upsert(roleRows);
      if (roleError) {
        console.warn(`⚠️ Batch ${c} user_roles upsert warning: ${roleError.message}`);
      }

      created += batchProfiles.length;
      const pct = Math.round(((c + 1) / totalChunks) * 100);

      console.log(
        `✅ Batch ${c} complete. Progress ${pct}% (${created}/${count}) | approved=${approvedCount} pending=${pendingCount} draft=${draftCount}`
      );

      await sleep(200);
    } catch (err: any) {
      failed += 1;
      console.error(`🚨 Fatal crash at chunk ${c}:`, err.message);
      break;
    }
  }

  console.log(
    `🏁 Generation cycle complete. created=${created}, failedChunks=${failed}, approved=${approvedCount}, pending=${pendingCount}, draft=${draftCount}`
  );
  return true;
}

generateTestUsers(parseCount()).catch((err) => {
  console.error('💥 Script failed:', err);
  process.exit(1);
});