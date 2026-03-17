import React, { useEffect, useRef } from 'react';

export default function LogTerminal({ className = '', emptyMessage, logs, style }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!logs.length || !containerRef.current) return;
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [logs]);

  return (
    <div ref={containerRef} className={`log-terminal lab-card__logs${className ? ` ${className}` : ''}`} style={style}>
      {logs.length === 0 ? (
        <div className="mono-code lab-muted">{emptyMessage}</div>
      ) : (
        logs.map((line, index) => (
          <div key={index} className="mono-code">
            {line}
          </div>
        ))
      )}
    </div>
  );
}
