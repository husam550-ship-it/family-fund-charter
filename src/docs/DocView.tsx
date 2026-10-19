import type { Doc } from './types';
import { Resolved } from '../components/ui';
import { dateLabel } from '../lib/format';

/** المعاينة والطباعة: نسخة A4 عربية RTL بعناوين وجداول وترقيم متسلسل للبنود */
export const DocView = ({ doc }: { doc: Doc }) => (
  <article className="doc-page" dir="rtl" lang="ar">
    <header className="doc-cover">
      <h1>{doc.title}</h1>
      <div className="sub">{doc.subtitle}</div>
      <p className="sub" style={{ marginTop: '18pt' }}>
        الإصدار: {doc.version}
        <br />
        تاريخ الإصدار: {dateLabel(doc.issueDate)}
        {doc.reviewDate && (
          <>
            <br />
            تاريخ المراجعة: {dateLabel(doc.reviewDate)}
          </>
        )}
      </p>
    </header>

    {doc.toc.length > 0 && (
      <section className="doc-toc" aria-label="فهرس المحتويات">
        <h2>فهرس المحتويات</h2>
        <ol style={{ paddingInlineStart: 0 }}>
          {doc.toc.map((t, i) => (
            <li key={i}>
              {i + 1}. {t}
            </li>
          ))}
        </ol>
      </section>
    )}

    {doc.blocks.map((b, i) => {
      switch (b.t) {
        case 'h':
          return b.level === 1 ? <h1 key={i}>{b.text}</h1> : b.level === 2 ? <h2 key={i}>{b.text}</h2> : <h3 key={i}>{b.text}</h3>;
        case 'p':
          return (
            <p key={i}>
              <Resolved text={b.text} />
            </p>
          );
        case 'ul':
          return (
            <ul key={i}>
              {b.items.map((x, j) => (
                <li key={j}>
                  <Resolved text={x} />
                </li>
              ))}
            </ul>
          );
        case 'ol':
          return (
            <ol key={i}>
              {b.items.map((x, j) => (
                <li key={j}>
                  <Resolved text={x} />
                </li>
              ))}
            </ol>
          );
        case 'table':
          return (
            <table key={i}>
              <thead>
                <tr>
                  {b.head.map((h, j) => (
                    <th key={j}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j}>
                    {r.map((c, k) => (
                      <td key={k}>
                        <Resolved text={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        case 'clause':
          return (
            <div key={i} className={`doc-clause ${b.status}`}>
              <b>
                بند {b.n}: {b.title}
              </b>
              <span className={`tag ${b.status}`}>{b.status === 'approved' ? 'معتمد' : 'مقترح'}</span>
              <p>
                <Resolved text={b.text} />
              </p>
            </div>
          );
        case 'note':
          return (
            <div key={i} className={`doc-note ${b.kind === 'warn' ? 'warn' : ''}`}>
              <Resolved text={b.text} />
            </div>
          );
        case 'pagebreak':
          return <div key={i} className="page-break" />;
      }
    })}

    {doc.signatures && (
      <section style={{ breakBefore: 'page' }}>
        <h2>صفحة الاعتماد والتوقيعات</h2>
        <p>اعتُمدت هذه الوثيقة بتاريخ: ____ / ____ / ________</p>
        <div className="doc-sign">
          {doc.signatures.map((s) => (
            <div key={s.id}>
              {s.name || '..............................'}
              <br />
              <small>{s.role}</small>
            </div>
          ))}
        </div>
        <p style={{ marginTop: '18pt', fontSize: '10pt' }}>التوقيعات اختيارية، ولا تعني الاعتماد النظامي ما لم تقترن بالإجراءات المقررة.</p>
      </section>
    )}
  </article>
);
