import styles from './page.module.css';

const metrics = [
  { label: 'Net balance', value: '$18,440.58', trend: '+12.4%' },
  { label: 'Monthly spend', value: '$3,840.20', trend: '-4.8%' },
  { label: 'Active users', value: '1,284', trend: '+8.1%' },
  { label: 'Approval rate', value: '96.3%', trend: '+1.2%' },
];

const transactions = [
  { name: 'Groceries', amount: '-$247.80', user: 'Marcus Lee', time: '2h ago' },
  { name: 'Freelance payout', amount: '+$1,200.00', user: 'Aaliyah Reed', time: 'Today' },
  { name: 'Transport', amount: '-$82.40', user: 'Jordan Kim', time: 'Yesterday' },
];

const categories = [
  { name: 'Housing', value: '32%', color: '#7c3aed' },
  { name: 'Food', value: '24%', color: '#f59e0b' },
  { name: 'Savings', value: '18%', color: '#10b981' },
  { name: 'Transport', value: '14%', color: '#3b82f6' },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>S</span>
          <div>
            <p className={styles.brandLabel}>SAVE</p>
            <small>Admin</small>
          </div>
        </div>

        <nav className={styles.nav}>
          <button className={`${styles.navItem} ${styles.active}`}>Overview</button>
          <button className={styles.navItem}>Transactions</button>
          <button className={styles.navItem}>Budgets</button>
          <button className={styles.navItem}>Reports</button>
          <button className={styles.navItem}>Users</button>
        </nav>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Finance overview</p>
            <h1>Admin dashboard</h1>
          </div>
          <button className={styles.primaryButton}>Export report</button>
        </header>

        <div className={styles.metricGrid}>
          {metrics.map((metric) => (
            <article key={metric.label} className={styles.metricCard}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <em>{metric.trend}</em>
            </article>
          ))}
        </div>

        <div className={styles.panelGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Recent transactions</h2>
              <button>View all</button>
            </div>

            <div className={styles.list}>
              {transactions.map((item) => (
                <div key={item.name} className={styles.listRow}>
                  <div>
                    <p>{item.name}</p>
                    <small>{item.user}</small>
                  </div>
                  <div className={styles.listMeta}>
                    <strong>{item.amount}</strong>
                    <span>{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Spending mix</h2>
              <button>Update</button>
            </div>

            <div className={styles.categoryList}>
              {categories.map((item) => (
                <div key={item.name} className={styles.categoryRow}>
                  <div className={styles.categoryMeta}>
                    <span className={styles.swatch} style={{ background: item.color }} />
                    <label>{item.name}</label>
                  </div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
