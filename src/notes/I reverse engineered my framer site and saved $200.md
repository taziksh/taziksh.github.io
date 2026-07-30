---
title: I reverse engineered my framer site and saved $200
date: 2026-07-30
public: true
---
I was using Framer for my iOS app's [landing page](https://tryclearly.app). But then I remembered it's 2026 -- why pay $200/year to Framer when I can build my own?

There's a reason I hadn't attempted this migration before, despite it crossing my mind. I liked the animations on my website! And I wasn't enough of a frontend whiz to get it done without significant effort, which was more profitably directed to other parts of the business.

I called my good friend, Claude Fable 5. Fable didn't even ask for my Framer login, yet somehow managed to dang near replicate every little detail of the site.

In more detail, Fable:
- Grabbed computed styles and design tokens from the live site's CSS
- Extracted assets at full resolution
- Recorded animations frame-by-frame to fit the spring constants

<video src="/notes/clearly-scroll.mp4" autoplay loop muted playsinline></video>

Toward the end, I handed the site to GPT 5.6 Sol for crucial testing (timing, coverage) and visual refinements.

What did I learn?
- **Computer use** is really good now. Fable/Sol operated an actual browser and verified the output pixel-by-pixel. I was mostly there for feedback. I would argue that because of improvements in the harness, namely tool calls and verifiable pixel diffing, frontier models are quite capable of autonomously redesigning software frontends.
- **Visual reasoning** is still limited -- both Fable and Sol struggled to notice an issue with overlapped phone mocks, even after being told about it many, many times! 5.6 Sol finally solved it, but I did prompt it differently, and most of the prior work was done by Fable, so this isn't necessarily indicative of superiority. The blindspots suggest some serious gaps. I mean to look more into vision evals. Kimi's recent [PerceptionBench](https://www.kimi.com/blog/perception-bench) seems relevant here.

![[Screenshot 2026-07-27 at 1.30.25 PM.png|Overlapping iPhone mockups]]

Here's the website, if you guys are curious!
https://tryclearly.app