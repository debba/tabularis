'use client';

export function ManageCookiesButton() {
  return (
    <button
      className="footer-manage-cookies"
      onClick={() => window.dispatchEvent(new Event('tabularis:manage-cookies'))}
    >
      Manage Cookies
    </button>
  );
}
