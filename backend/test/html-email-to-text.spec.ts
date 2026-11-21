import { htmlEmailToText } from '../src/common/html-email-to-text';

describe('htmlEmailToText', () => {
  it('removes markup and preserves readable text/spacing', () => {
    expect(htmlEmailToText('<p>Hello <b>world</b></p><p>Next<br>line</p>')).toBe('Hello world\nNext\nline');
  });

  it('removes dangerous embedded content including script/style blocks', () => {
    expect(htmlEmailToText('Safe<script>alert(1)</script><style>body{display:none}</style><iframe>bad</iframe>Text')).toBe('Safe Text');
  });

  it('decodes common and numeric entities without reintroducing markup', () => {
    expect(htmlEmailToText('A&amp;B &nbsp; &#x1F600; &lt;script&gt;')).toBe('A&B 😀 <script>');
  });

  it('handles empty input', () => {
    expect(htmlEmailToText('')).toBe('');
  });
});
