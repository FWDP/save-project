import { Brand, Icon } from "./icon";
import type { ReactNode } from "react";
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-copy">
          <span className="eyebrow">
            A little clarity. A lot of possibility.
          </span>
          <h1>
            Make room for
            <br />
            what matters<span className="mint">.</span>
          </h1>
          <p>
            Your everyday spending and your next big idea. Give both a place to
            grow.
          </p>
          <div className="story-points">
            <span>
              <Icon name="check" /> Personal & business workspaces
            </span>
            <span>
              <Icon name="check" /> One clear view of your money
            </span>
            <span>
              <Icon name="check" /> Your records, on your terms
            </span>
          </div>
        </div>
        <div className="auth-footer">
          <span>Built for everyday progress.</span>
          <span>Personal · Business</span>
        </div>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
