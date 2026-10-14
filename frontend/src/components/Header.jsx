import "./header.scss";

export default function Header({ onMenuClick }) {
  return (
    <header className="topbar">
      <button
        className="topbar__menu"
        type="button"
        aria-label="Open navigation menu"
        onClick={onMenuClick}
      >
        <span /><span /><span />
      </button>
    </header>
  );
}
