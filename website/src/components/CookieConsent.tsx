'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type CookiePrefs = {
  necessary: true;
  measurement: boolean;
  marketing: boolean;
};

const STORAGE_KEY = 'tabularis-cookie-consent';
const MATOMO_URL = '//analytics.debbaweb.it/';
const MATOMO_SITE_ID = '4';

/**
 * Loads the Matomo script and configures consent-based cookie behaviour.
 *
 * Without measurement consent → disableCookies() (cookieless tracking, GDPR
 * legitimate-interest basis). IP anonymisation must be enabled server-side in
 * Matomo → Settings › Privacy › Anonymize data.
 *
 * With measurement consent → full cookie-based tracking.
 *
 * If the script is already loaded, only the cookie consent state is updated.
 */
function initMatomo(cookieConsent: boolean) {
  if (typeof window === 'undefined') return;

  const _paq: unknown[][] = ((window as any)._paq =
    (window as any)._paq || []);

  if ((window as any).__matomoLoaded) {
    // Script already running — only update cookie consent state
    if (cookieConsent) {
      _paq.push(['setCookieConsentGiven']);
    } else {
      _paq.push(['forgetCookieConsentGiven']);
      _paq.push(['disableCookies']);
    }
    return;
  }

  (window as any).__matomoLoaded = true;

  if (cookieConsent) {
    // Full tracking with cookies
    _paq.push(['setCookieConsentGiven']);
  } else {
    // Cookieless tracking — disableCookies() is widely supported and
    // definitively prevents any cookie from being set
    _paq.push(['disableCookies']);
  }

  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  _paq.push(['setTrackerUrl', MATOMO_URL + 'matomo.php']);
  _paq.push(['setSiteId', MATOMO_SITE_ID]);

  const d = document;
  const g = d.createElement('script');
  const s = d.getElementsByTagName('script')[0];
  g.async = true;
  g.src = MATOMO_URL + 'matomo.js';
  s.parentNode!.insertBefore(g, s);
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [measurement, setMeasurement] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // Initialise Matomo on mount
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      initMatomo(false);
      setVisible(true);
    } else {
      try {
        const prefs: CookiePrefs = JSON.parse(raw);
        setMeasurement(prefs.measurement);
        setMarketing(prefs.marketing);
        initMatomo(prefs.measurement);
      } catch {
        initMatomo(false);
        setVisible(true);
      }
    }

    // Allow any part of the page to re-open the banner
    function handleManage() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const prefs: CookiePrefs = JSON.parse(raw);
          setMeasurement(prefs.measurement);
          setMarketing(prefs.marketing);
        } catch {
          // leave current state
        }
      }
      setVisible(true);
    }

    window.addEventListener('tabularis:manage-cookies', handleManage);
    return () =>
      window.removeEventListener('tabularis:manage-cookies', handleManage);
  }, []);

  function save(measurementVal: boolean, marketingVal: boolean) {
    const prefs: CookiePrefs = {
      necessary: true,
      measurement: measurementVal,
      marketing: marketingVal,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setMeasurement(measurementVal);
    setMarketing(marketingVal);
    setVisible(false);
    initMatomo(measurementVal);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie preferences">
      <p className="cookie-desc">
        Tabularis uses cookies to improve your experience and for analytics.{' '}
        <Link href="/cookie-policy">Read our cookie policy</Link> for more
        details.
      </p>

      <div className="cookie-rows">
        <div className="cookie-row">
          <span className="cookie-label">NECESSARY</span>
          <div
            className="cookie-toggle cookie-toggle--on cookie-toggle--locked"
            title="Necessary cookies are always active"
          >
            <span className="cookie-toggle-thumb" />
          </div>
        </div>

        <div className="cookie-row">
          <span className="cookie-label">MEASUREMENT</span>
          <button
            className={`cookie-toggle ${measurement ? 'cookie-toggle--on' : 'cookie-toggle--off'}`}
            onClick={() => setMeasurement((v) => !v)}
            aria-pressed={measurement}
            aria-label="Toggle measurement cookies"
          >
            <span className="cookie-toggle-thumb" />
          </button>
        </div>

        <div className="cookie-row">
          <span className="cookie-label">MARKETING</span>
          <button
            className={`cookie-toggle ${marketing ? 'cookie-toggle--on' : 'cookie-toggle--off'}`}
            onClick={() => setMarketing((v) => !v)}
            aria-pressed={marketing}
            aria-label="Toggle marketing cookies"
          >
            <span className="cookie-toggle-thumb" />
          </button>
        </div>
      </div>

      <div className="cookie-actions">
        <button
          className="cookie-btn cookie-btn--save"
          onClick={() => save(measurement, marketing)}
        >
          Save
        </button>
        <button
          className="cookie-btn cookie-btn--reject"
          onClick={() => save(false, false)}
        >
          Reject All
        </button>
        <button
          className="cookie-btn cookie-btn--accept"
          onClick={() => save(true, true)}
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
