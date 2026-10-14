// Who this bot is. Frozen on purpose.
//
// The name and the credit are NOT settings: they are not in the database and
// not editable from the dashboard. Every template renders from this object —
// app.cjs assigns it to `app.locals.brand` — so everything on it is public by
// definition.
//
// That is exactly why the AI's identity block is NOT here any more. It lives in
// src/config/ai-identity.cjs, which the agent imports and no template, route or
// setting can reach. Keeping model instructions on the same object the views
// render was one `<%= %>` away from putting them on a web page.

const BRAND = Object.freeze({
  name: "Yuxli",
  nameAr: "يوكسلي",
  tagline: "Personal WhatsApp Bot & Productivity Suite",
  taglineAr: "بوت واتساب ذكي ومساعد إنتاجي متقدم",

  copyrightYear: 2026,
  developer: "Sheikh Salman",
  developerAr: "الشيخ سلمان",
  developerUr: "شیخ سلمان",
  developerSite: "https://github.com/ItSheikhSalman",
  studio: "Yuxli Technologies",
  studioSite: "https://github.com/ItSheikhSalman/yuxli",

  repo: "https://github.com/ItSheikhSalman/yuxli",
});

module.exports = BRAND;
