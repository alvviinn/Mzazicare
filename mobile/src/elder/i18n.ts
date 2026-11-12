// Plain-language text for the elderly screen, in English and Kiswahili.
// NOTE: the Kiswahili should be reviewed by a native speaker before a real pilot.
export type Lang = 'en' | 'sw';

type Str = string | ((a: string) => string);

const STRINGS: Record<string, { en: Str; sw: Str }> = {
  morning: { en: 'Good morning', sw: 'Habari za asubuhi' },
  afternoon: { en: 'Good afternoon', sw: 'Habari za mchana' },
  evening: { en: 'Good evening', sw: 'Habari za jioni' },

  right_now: { en: 'Right now', sw: 'Sasa hivi' },
  today: { en: 'Today', sw: 'Leo' },
  stay_in_touch: { en: 'Stay in touch', sw: 'Endelea kuwasiliana' },
  about: { en: 'About this app', sw: 'Kuhusu programu hii' },
  text_size: { en: 'Text size', sw: 'Ukubwa wa maandishi' },
  language: { en: 'Language', sw: 'Lugha' },
  why_location: { en: 'Why location?', sw: 'Kwa nini mahali?' },
  invited: { en: 'Invited', sw: 'Amealikwa' },
  caretaker_here:{ en: (n) => `${n} is here with you`, sw: (n) => `${n} yuko nawe` },
  caretaker_away: { en: (n) => `${n} stepped out`, sw: (n) => `${n} ametoka kidogo` },
  caretaker_left: { en: (n) => `${n} has finished for today`, sw: (n) => `${n} amemaliza leo` },
  caretaker_not_arrived: { en: (n) => `${n} is on the way`, sw: (n) => `${n} yuko njiani` },
  caretaker_none: { en: 'No caretaker yet', sw: 'Bado hakuna mlezi' },

  feeling_q: { en: 'How do you feel?', sw: 'Unajisikiaje?' },
  good: { en: 'Good', sw: 'Vizuri' },
  okay: { en: 'Okay', sw: 'Sawa' },
  unwell: { en: 'Not well', sw: 'Si vizuri' },
  feeling_thanks: { en: 'Family knows', sw: 'Familia inajua' },
  feeling_unwell_thanks: { en: 'Family has been told', sw: 'Familia imeambiwa' },
  change: { en: 'Change', sw: 'Badilisha' },

  medicine_title: { en: "Today's medicine", sw: 'Dawa za leo' },
  took_it: { en: 'I took it', sw: 'Nimekunywa' },
  taken: { en: 'Taken', sw: 'Imekunywa' },
  due_now: { en: 'Take it now', sw: 'Kunywa sasa' },
  missed: { en: 'Not taken yet', sw: 'Bado hujakunywa' },
  later_at: { en: (t) => `At ${t}`, sw: (t) => `Saa ${t}` },

  msg_family: { en: (n) => `Message ${n}`, sw: (n) => `Mwandikie ${n}` },
  help_button: { en: 'I need help', sw: 'Nahitaji msaada' },
  help_title: { en: 'Call for help?', sw: 'Omba msaada?' },
  help_body: { en: 'Your family will be told right away.', sw: 'Familia yako itaarifiwa mara moja.' },
  yes_send: { en: 'Yes, send', sw: 'Ndiyo, tuma' },
  no: { en: 'No', sw: 'Hapana' },
  sent: { en: 'Sent', sw: 'Imetumwa' },
  help_sent:{ en: 'Your family has been told.', sw: 'Familia yako imeambiwa.' },
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
  load_error: { en: "Can't connect · pull down to retry", sw: 'Hakuna mtandao · vuta chini' },
};

export function t(lang: Lang, key: string, arg = ''): string {
  const s = STRINGS[key]?.[lang] ?? key;
  return typeof s === 'function' ? s(arg) : s;
}
