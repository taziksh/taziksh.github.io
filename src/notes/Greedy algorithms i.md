---
title: "Greedy algorithms: do all the activities!"
date: 2026-06-09
public: true
---
Today, we're going to look at a classic problem:

> Given $n$ events with their start and end times, find a schedule that includes as many events as possible.

Let's use an example to motivate our problem:

| Event | Name                 | Starting time | Ending time |
| ----- | -------------------- | ------------: | ----------: |
| A     | Alarm snooze         |             1 |           3 |
| B     | Bake bread           |             2 |           5 |
| C     | Cook omelettes       |             3 |           9 |
| D     | Dance in the kitchen |             6 |           8 |

Visually:

![](/notes/greedy_events.png)

Idea 1: select as **short events as possible**

This *seems* to work. Here, we end up with two events.

![](/notes/greedy_short_works.png)

But here's a counterexample:

![](/notes/greedy_short_counterexample.png)

Selecting the short event allows us to only select one, instead of the two long events.

Idea 2: select the next possible event that begins **as early as possible**

![](/notes/greedy_early_start.png)

Again, this seems to work!

Can you find a counterexample for this?

![](/notes/greedy_early_start_counterexample.png)

Here, we have an early event that lasts a really long time, preventing us from participating in two events.

Idea 3: always select the next possible event that **ends as early as possible**

![](/notes/greedy_earliest_end.png)

Can you find a counterexample for this?

This actually produces an optimal solution.

We can try and understand how by reasoning as follows:

1. Let $E$ be the event that ends the earliest. 
2. Take any optimal schedule. 
3. If it does not use $E$ first, replace its first event with $E$. This is safe because $E$ ends no later than that first event, so every later event still fits. The schedule has the same number of events. This means choosing $E$ first cannot make the answer worse. 
4. Now that $E$ is chosen, ignore the events that overlap with it. Among the events left, use the same rule again: choose the one that ends earliest. 
5. After removing $E$ and its conflicts, we're left with a smaller instance of the same problem, so the same argument applies

Here's an implementation:
```python
intervals.sort(key=lambda interval: interval[1])
num_intervals = 0
last_end = float("-inf")

for start, end in intervals:
	if start >= last_end:
		num_intervals += 1
		last_end = end
```


Further reading:
- [*Competitive Programmer's Handbook*](https://cses.fi/book/book.pdf), Chapter 6
- [*Greedy is Good*](https://www.topcoder.com/thrive/articles/Greedy%20is%20Good), Topcoder.com

