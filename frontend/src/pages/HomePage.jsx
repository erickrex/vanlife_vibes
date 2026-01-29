import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-hero-copy">
          <p className="home-hero-kicker">VanlifeVibes · Group-level matching</p>
          <h1>Keep the team swiping, keep every voice in the tally.</h1>
          <p className="home-hero-body">
            VanlifeVibes is the multi-user “Tinder for X” template where groups
            steer every decision together. Sessions capture unanimous or threshold
            rules, the crew swipes on ideas, and only the options that satisfy the
            rule become matches with their own chat threads.
          </p>
          <div className="home-hero-ctas">
            <Link to="/signup" className="hero-cta primary">
              Create your crew
            </Link>
            <Link to="/login" className="hero-cta secondary">
              Already a member
            </Link>
          </div>
        </div>
        <div className="home-hero-panel">
          <div className="home-hero-metric">
            <h2>Group Power</h2>
            <p>Each match is elected by {`the whole crew`} and comes with chat.</p>
          </div>
          <div className="home-hero-metric">
            <h2>Flexible Options</h2>
            <p>Upload ideas, projects, venues, or candidates—each gets an optional image.</p>
          </div>
          <div className="home-hero-metric">
            <h2>Ready to remix</h2>
            <p>Drop the template onto your new “Tinder for X” idea and focus on the story.</p>
          </div>
        </div>
      </div>

      <section className="home-highlights">
        <article>
          <h3>Group-first matches</h3>
          <p>
            Sessions always honor the confirmed membership roster, so matches are
            locked in once the collective rule is satisfied—no side conversations.
          </p>
        </article>
        <article>
          <h3>Swipe items with optional visuals</h3>
          <p>
            Candidates can include rich metadata and images, keeping the swipe deck
            visually exciting without forcing assets.
          </p>
        </article>
        <article>
          <h3>Match chats, per decision</h3>
          <p>
            Every match gets a lightweight thread so follow-up debate is contained
            right where the decision happened.
          </p>
        </article>
      </section>
    </div>
  );
}

export default HomePage;
