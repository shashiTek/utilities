import React, { useState } from 'react';
import styles from './QueryDisplay.module.css';

export default function QueryDisplay({ query }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(query).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.topbar}>
        <span className={styles.label}>MongoDB aggregation query</span>
        <button className={styles.copy} onClick={copy}>
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <pre className={styles.code}>{query}</pre>
    </div>
  );
}
