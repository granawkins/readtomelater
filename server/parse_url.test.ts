import { describe, it, expect, spyOn, beforeEach, afterEach } from 'bun:test';
import { parse_url } from './parse_url';

// Mock HTML content based on https://blog.samaltman.com/the-gentle-singularity
const mockHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>The Gentle Singularity - Sam Altman</title>
</head>
<body>
  <div id="main">
    <article class="post">
      <header>
        <div class="post-title">
          <h2><a href="https://blog.samaltman.com/the-gentle-singularity">The Gentle Singularity</a></h2>
        </div>
      </header>
      <div class="post-body">
        <div class="posthaven-post-body">
          <p>We are past the event horizon; the takeoff has started. Humanity is close to building digital superintelligence, and at least so far it's much less weird than most people expected.</p>
          <p>The path forward is clear to me: we need to solve the technical challenges of alignment and then focus on making superintelligence widely available and not concentrated.</p>
          <ol>
            <li><p>Solve the alignment problem, meaning that we can robustly guarantee that we get AI systems to learn and act towards what we collectively really want over the long-term.</p></li>
            <li><p>Then focus on making superintelligence cheap, widely available, and not too concentrated with any person, company, or country.</p></li>
          </ol>
          <p>We are building a brain for the world. It will be extremely personalized and easy for everyone to use; we will be limited by good ideas.</p>
        </div>
      </div>
    </article>
  </div>
</body>
</html>
`;

describe('parse_url', () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(global, 'fetch').mockResolvedValue({
      text: () => Promise.resolve(mockHtml),
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should parse URL and return title and body', async () => {
    const result = await parse_url(
      'https://blog.samaltman.com/the-gentle-singularity'
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://blog.samaltman.com/the-gentle-singularity'
    );
    expect(result.title).toBe('The Gentle Singularity - Sam Altman');
    expect(result.body).toContain('We are past the event horizon');
    expect(result.body).toContain('building digital superintelligence');
    expect(result.body).toContain('alignment problem');
    expect(result.body).toContain('building a brain for the world');
  });

  it('should throw error when fetch fails', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    await expect(parse_url('https://example.com/invalid')).rejects.toThrow(
      'Network error'
    );
  });
});
