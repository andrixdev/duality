// FR/EN language switch shared by the app guide and the about page.
// Load it in <head> without defer so the language is set before the page paints.
//   - Elements with class "i18n" and a lang attribute only show in that language (see the CSS rule).
//   - Elements with data-i18n-attrs="src alt" swap those attributes from data-src-en / data-src-fr, etc.
//   - <title data-title-en="..." data-title-fr="..."> swaps the document title.
//   - Any .lang-toggle button switches language; the choice is remembered across pages.
//   - A "duality:langchange" event is dispatched on document so scripts can refresh their own texts.
(() => {
  const KEY = "duality-lang"
  const LANGS = ["en", "fr"]
  const root = document.documentElement

  let stored = null
  try { stored = localStorage.getItem(KEY) } catch (e) {}
  const browserLang = (navigator.language || "").toLowerCase().startsWith("fr") ? "fr" : "en"
  root.lang = LANGS.includes(stored) ? stored : browserLang

  const applyToDom = () => {
    const lang = root.lang
    document.querySelectorAll("[data-i18n-attrs]").forEach(el => {
      el.dataset.i18nAttrs.split(/\s+/).forEach(attr => {
        const value = el.getAttribute(`data-${attr}-${lang}`)
        if (value !== null && el.getAttribute(attr) !== value) el.setAttribute(attr, value)
      })
    })
    const title = document.querySelector("title")
    const titleText = title && title.getAttribute(`data-title-${lang}`)
    if (titleText) document.title = titleText
    document.querySelectorAll(".lang-toggle").forEach(btn => {
      btn.setAttribute("aria-label", lang === "fr" ? "Switch to English" : "Passer en français")
    })
  }

  const setLang = lang => {
    root.lang = lang
    try { localStorage.setItem(KEY, lang) } catch (e) {}
    applyToDom()
    document.dispatchEvent(new CustomEvent("duality:langchange", { detail: { lang } }))
  }

  window.dualityLang = { get: () => root.lang, set: setLang }

  document.addEventListener("DOMContentLoaded", () => {
    applyToDom()
    document.querySelectorAll(".lang-toggle").forEach(btn => {
      btn.addEventListener("click", ev => {
        setLang(root.lang === "fr" ? "en" : "fr")
        // Drop focus after a mouse click so later key presses go to the simulation, not the button
        if (ev.detail > 0) btn.blur()
      })
    })
  })
})()
