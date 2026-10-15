// Plain-language text for the elderly screen, in English and Kiswahili.
// NOTE: the Kiswahili should be reviewed by a native speaker before a real pilot.
export type Lang = 'en' | 'sw';

type Str = string | ((a: string) => string);

const STRINGS: Record<string, { en: Str; sw: Str }> = {
  morning: { en: 'Good morning', sw: 'Habari za asubuhi' },
  afternoon: { en: 'Good afternoon', sw: 'Habari za mchana' },
  evening: { en: 'Good evening', sw: 'Habari za jioni' },

  caretaker_here: { en: (n) => `${n} is here with you`, sw: (n) => `${n} yuko nawe` },
  caretaker_away: { en: (n) => `${n} has stepped out for a moment`, sw: (n) => `${n} ametoka kwa muda mfupi` },
  caretaker_left: { en: (n) => `${n} has finished today's visit`, sw: (n) => `${n} amemaliza ziara ya leo` },
  caretaker_not_arrived: { en: (n) => `${n} has not arrived yet`, sw: (n) => `${n} hajafika bado` },
  caretaker_none: { en: 'No caretaker has been added yet', sw: 'Bado hujaongezewa mlezi' },

  feeling_q: { en: 'How are you feeling today?', sw: 'Unajisikiaje leo?' },
  good: { en: 'Good', sw: 'Vizuri' },
  okay: { en: 'Okay', sw: 'Sawa' },
  unwell: { en: 'Not well', sw: 'Si vizuri' },
  feeling_thanks: { en: 'Thank you! Your family knows.', sw: 'Asante! Familia yako inajua.' },
  feeling_unwell_thanks: {
    en: 'Sorry to hear that. We have told your family.',
    sw: 'Pole sana. Tumewaambia familia yako.',
  },
  change: { en: 'Change', sw: 'Badilisha' },

  medicine_title: { en: "Today's medicine", sw: 'Dawa za leo' },
  took_it: { en: 'I took it', sw: 'Nimekunywa' },
  taken: { en: 'Taken ✓', sw: 'Imekunywa ✓' },
  due_now: { en: 'Time to take it', sw: 'Ni wakati wa kunywa' },
  missed: { en: 'Not taken yet', sw: 'Bado hujakunywa' },
  later_at: { en: (t) => `At ${t}`, sw: (t) => `Saa ${t}` },

  msg_family: { en: (n) => `Message ${n}`, sw: (n) => `Mwandikie ${n}` },
  help_button: { en: 'I NEED HELP', sw: 'NAHITAJI MSAADA' },
  help_title: { en: 'Call for help?', sw: 'Omba msaada?' },
  help_body: { en: 'Your family will be told right away.', sw: 'Familia yako itaarifiwa mara moja.' },
  yes_send: { en: 'Yes, send', sw: 'Ndiyo, tuma' },
  no: { en: 'No', sw: 'Hapana' },
  help_sent: { en: 'Your family has been told.', sw: 'Familia yako imeambiwa.' },
  help_failed: {
    en: 'Could not send. Please call your family now.',
    sw: 'Imeshindwa kutuma. Tafadhali piga simu kwa familia yako sasa.',
  },

  phone_title: { en: 'Your phone', sw: 'Simu yako' },
  phone_body: {
    en: 'Your phone tells MzaziCare where it is only to confirm that your caretaker is with you. Your caretaker cannot see where you are. Please keep this app open when your caretaker visits.',
    sw: 'Simu yako hutuma mahali ilipo kwa MzaziCare ili kuthibitisha kuwa mlezi wako yuko nawe. Mlezi wako haoni uliko. Tafadhali weka programu hii wazi mlezi wako anapokuja.',
  },
  circle_title: { en: 'Your family and carers', sw: 'Familia na walezi wako' },
  family: { en: 'Family', sw: 'Familia' },
  caretaker: { en: 'Caretaker', sw: 'Mlezi' },
  sign_out: { en: 'Sign out', sw: 'Toka' },
  load_error: {
    en: "Can't reach the server. Pull down to try again.",
    sw: 'Seva haipatikani. Vuta chini kujaribu tena.',
  },
};

export function t(lang: Lang, key: string, arg = ''): string {
  const s = STRINGS[key]?.[lang] ?? key;
  return typeof s === 'function' ? s(arg) : s;
}
