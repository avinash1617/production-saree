import { useState } from "react";

const categories = ["Sarees", "Blouses", "Kurtis & tops", "Dress Materials", "New arrivals"];
const sareeFabrics = [
  "Cotton Sarees",
  "Kota Sarees",
  "Khadi Sarees",
  "Linen Sarees",
  "Crepe Sarees",
  "Silk Sarees",
  "Pattu Sarees",
  "Tissue Sarees",
  "Chiffon Sarees",
  "Organza Saree",
  "Tussar Sarees",
];

export default function Navbar({ bagCount, onCategorySelect, onFabricSelect, onCartOpen }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sareesOpen, setSareesOpen] = useState(false);

  function selectCategory(category) {
    onCategorySelect(category);
    onFabricSelect("");
    setMenuOpen(false);
    setSareesOpen(false);
  }

  function selectFabric(fabric) {
    onCategorySelect("Sarees");
    onFabricSelect(fabric.replace(/ sarees?$/i, "").toLowerCase());
    setMenuOpen(false);
    setSareesOpen(false);
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          className="menu-toggle icon-button"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen((open) => !open);
            setSareesOpen(false);
          }}
        >
          <span />
          <span />
        </button>
        <a className="wordmark" href="#top" aria-label="Nihira Looms home">
          Nihira<span> Looms</span>
          <small>THE SAREE EDIT</small>
        </a>
        <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
          <div
            className={`nav-dropdown${sareesOpen ? " is-open" : ""}`}
            onMouseEnter={() => setSareesOpen(true)}
            onMouseLeave={() => setSareesOpen(false)}
            onFocusCapture={() => setSareesOpen(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setSareesOpen(false);
              }
            }}
          >
            <button
              className="nav-category"
              type="button"
              aria-expanded={sareesOpen}
              aria-haspopup="true"
              onClick={() => {
                onCategorySelect("Sarees");
                onFabricSelect("");
                setSareesOpen((open) => !open);
              }}
            >
              Sarees <span className="nav-chevron" aria-hidden="true">⌄</span>
            </button>
            <div
              className="fabric-menu"
              role="group"
              aria-labelledby="fabric-menu-title"
            >
              <p id="fabric-menu-title">Shop by fabric</p>
              <div className="fabric-menu-links">
                {sareeFabrics.map((fabric) => (
                  <a
                    href="#collection"
                    key={fabric}
                    onClick={() => selectFabric(fabric)}
                  >
                    {fabric}
                  </a>
                ))}
              </div>
            </div>
          </div>
          {categories.slice(1).map((category) => (
            <a
              href="#collection"
              key={category}
              onClick={() => selectCategory(category)}
            >
              {category}
            </a>
          ))}
        </nav>
        <button
          className="bag-link"
          type="button"
          aria-label={`Open shopping bag, ${bagCount} items`}
          onClick={onCartOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5.5 8.5h13l1 12h-15l1-12Z" />
            <path d="M9 9V6a3 3 0 0 1 6 0v3" />
          </svg>
          <span>Bag</span>
          <span className="bag-count">{bagCount}</span>
        </button>
      </div>
    </header>
  );
}