---
title: Death by a thousand pops
date: 2026-06-05
public: true
---
Not everything on the internet is true.

Today, I forgot my merge sort.

I knew it had to do with recursing to the base case of single-value arrays, comparing those, then building back up. But I felt too lazy to type it out. 

So I looked it up. I referenced this handy [cheatsheet](https://jwl-7.github.io/leetcode-cheatsheet/#ds-array) of algorithms & data structures. It was the #2 result that popped up when I googled "leetcode cheat sheet".

I took this merge sort implementation, and adapted it for the problem I was working on. It's a puzzle called [Counting Inversions](https://www.hackerrank.com/challenges/ctci-merge-sort/problem).

After a bit, I solved it!

Huh? What? Testcases 10, 11, and 12 failing?
Time limit exceeded?!


Merge sort runs in O(N * logN). 
- recursively halves the array (log N)
- then merges each of the arrays (N). 

But I was TLE-ing. I took a closer look at my code. 

Do you see the problem?

```python
def merge(l, r): 
	res = [] 
	cnt = 0 
	while l and r: 
		if l[0] > r[0]: 
			res.append(r.pop(0)) 
			cnt += len(l) 
		else: 
			res.append(l.pop(0)) 
	res.extend(l) 
	res.extend(r) 
	return res, cnt
```


When you pop from the _end_ of an array, that runs in O(1). But pop from the start? Welp, you have to shift all the other elements - hence O(N)!

  
What if we *didn't* mutate our arrays in-place? Instead, we could keep *track* of the number of required pops. Finally, we can skip over these indices. 

  ```python
def merge(l, r): 
	res = [] 
	cnt = 0 
	i = j = 0
	while i < len(l) and j < len(r): 
		if l[i] > r[j]: 
			res.append(r[j])
			j += 1 
			cnt += len(l) - i
		else: 
			res.append(l[i])
			i += 1 
	res.extend(l[i:]) 
	res.extend(r[j:]) 
	return res, cnt
  ```

This passed all 12 testcases!

I still think the cheatsheet is a great resource. So I made a pull request to fix the slow merge sort implementation in Python/JavaScript/C++. The Java/Lua/Ruby merge sorts were already correct.

What are my takeaways?
1. Remember what your built-in operations cost. `pop(0)` seems innocuous but upon a bit of reflection isn't!
2. Remember that just because something is on the internet doesn't mean it's right