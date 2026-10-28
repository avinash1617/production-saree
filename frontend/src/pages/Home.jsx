import { useEffect, useMemo, useState } from "react";
import { api, formatPrice } from "../lib/api.js";

const categories = ["Sarees", "Blouses", "Kurtis & tops", "Dress Materials", "New arrivals"];

function ProductCard({ product, onAddToBag }) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <img
          className="product-image"
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
        />
        {product.isNew && <span className="product-badge">Just arrived</span>}
        {product.stock > 0 ? (
          <button className="quick-add" type="button" onClick={() => onAddToBag(product)}>
            Add to bag <span aria-hidden="true">+</span>
          </button>
        ) : (
          <span className="product-badge sold-out-badge">Sold out</span>
        )}
      </div>
      <div className="product-info">
        <div>
          <h3>{product.name}</h3>
          <p>{product.fabric || product.category}</p>
        </div>
        <span className="product-price">{formatPrice(Math.round(product.price * 100))}</span>
      </div>
    </article>
  );
}

export default function Home({
  activeCategory,
  activeFabric,
  onCategorySelect,
  onFabricSelect,
  onAddToBag,
  refreshKey,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api("/products")
      .then(({ products: loadedProducts }) => {
        if (active) {
          setProducts(loadedProducts);
          setLoadError("");
        }
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [refreshKey]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = activeCategory === "New arrivals"
        ? product.isNew
        : product.category === activeCategory;
      const matchesFabric = !activeFabric ||
        product.fabric.toLowerCase().includes(activeFabric);
      const matchesSearch =
        !query ||
        `${product.name} ${product.description} ${product.fabric} ${product.category}`.toLowerCase().includes(query);
      return matchesCategory && matchesFabric && matchesSearch;
    });
  }, [activeCategory, activeFabric, products, search]);

  return (
    <main id="top">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Woven slowly, worn forever</p>
          <h1>A little piece<br />of <em>you.</em></h1>
          <p className="hero-description">
            Sarees that hold stories, celebrate the everyday, and feel like they were always yours.
          </p>
          <a className="button button-dark" href="#collection">
            Find your saree <span aria-hidden="true">↗</span>
          </a>
          <div className="hero-note">
            <span className="note-line" />
            Thoughtfully made in India
          </div>
        </div>
        <div className="hero-visual">
          <img
            src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1500&q=90"
            alt="Woman wearing a beautifully draped Indian saree"
            loading="eager"
          />
          <div className="hero-caption">
            <span>01 / 04</span>
            <span>For every version of you</span>
          </div>
          <div className="round-stamp" aria-label="Made by hand, made to last">
            <span>MADE BY HAND</span>
            <span className="stamp-star">✳</span>
            <span>MADE TO LAST</span>
          </div>
        </div>
        <span className="hero-index">THE NIHIRA LOOMS COLLECTION</span>
      </section>

      <section className="promise-strip" aria-label="Our values">
        <p>Rooted in craft</p><span>✳</span>
        <p>Made for real life</p><span>✳</span>
        <p>Always one of a kind</p><span>✳</span>
        <p>Rooted in craft</p>
      </section>

      <section className="collection section-shell" id="collection">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A sari for every story</p>
            <h2>Find your <em>forever</em> one.</h2>
          </div>
          <label className="search-field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              type="search"
              aria-label="Search sarees"
              placeholder="Find something lovely"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className="collection-controls">
          <div className="category-tabs" role="group" aria-label="Filter by collection">
            {categories.map((category) => (
              <button
                className={activeCategory === category ? "category-tab active" : "category-tab"}
                key={category}
                type="button"
                aria-pressed={activeCategory === category}
                onClick={() => {
                  onCategorySelect(category);
                  onFabricSelect("");
                }}
              >
                {category}
              </button>
            ))}
          </div>
          <span className="product-count">{visibleProducts.length} pieces</span>
        </div>
        {loadError ? (
          <div className="empty-results" role="alert">
            <p>We couldn’t load the collection.</p>
            <span>{loadError}</span>
          </div>
        ) : loading ? (
          <div className="empty-results" role="status"><p>Loading the collection…</p></div>
        ) : visibleProducts.length > 0 ? (
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAddToBag={onAddToBag} />
            ))}
          </div>
        ) : (
          <div className="empty-results">
            <p>{products.length ? "No pieces in this collection yet." : "Our collection is being prepared."}</p>
            <button type="button" onClick={() => { setSearch(""); onCategorySelect("Sarees"); onFabricSelect(""); }}>
              Browse the saree collection
            </button>
          </div>
        )}
        <div className="collection-footer">
          <span>Made in small batches. Kept for a lifetime.</span>
          <a href="#story">A note on how we make things <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section className="story-band" id="story">
        <div className="story-image">
          <img
            src="https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1100&q=85"
            alt="Artisan hands working with richly colored woven fabric"
            loading="lazy"
          />
        </div>
        <div className="story-copy">
          <p className="eyebrow">A little more meaning</p>
          <h2>Good things<br />take <em>hands.</em></h2>
          <p>
            Every Nihira Looms saree begins with a person, a place, and a practice passed down through generations.
            We work in small batches with independent Indian weavers, so the hands behind your saree are never forgotten.
          </p>
          <a className="text-link" href="#footer">Get to know us <span aria-hidden="true">↗</span></a>
          <span className="story-mark" aria-hidden="true">n.</span>
        </div>
      </section>

      <section className="newsletter">
        <p className="eyebrow">Made for all the beautiful in-between moments</p>
        <h2>Wear what<br />feels like <em>you.</em></h2>
        <a className="text-link" href="#collection">Explore the collection <span aria-hidden="true">↗</span></a>
      </section>

      <footer className="site-footer" id="footer">
        <a className="wordmark footer-wordmark" href="#top">
          Nihira<span> Looms</span><small>THE SAREE EDIT</small>
        </a>
        <p>For all the beautiful in-between moments.</p>
        <div className="footer-links">
          <a href="#collection">Shop</a>
          <a href="#story">Our story</a>
          <a href="#footer">Customer support</a>
          <span>© Nihira Looms {new Date().getFullYear()}</span>
        </div>
      </footer>
    </main>
  );
}