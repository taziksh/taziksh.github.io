---
title: Tseitin transformation
date: 2026-10-24
public: true
---

The Tseitin transformation lets us convert any Boolean formula to [conjunctive normal form (CNF)](https://en.wikipedia.org/wiki/Conjunctive_normal_form) by introducing new variables. Let's say we have the following expression:

$$
\phi := ((x_1 \lor x_2) \Leftrightarrow x_3) \Rightarrow (\lnot x_4).
$$

**Step 1.** Associate new variables with the subexpressions.

$$
y_1 \Leftrightarrow (x_1 \lor x_2)
$$

$$
y_2 \Leftrightarrow (y_1 \Leftrightarrow x_3)
$$

$$
y_3 \Leftrightarrow \lnot x_4
$$

$$
y_4 \Leftrightarrow (y_2 \Rightarrow y_3).
$$

**Step 2.** Restate the formula using these definitions.

$$
\begin{aligned}
C := {} & y_4 \land (y_4 \Leftrightarrow (y_2 \Rightarrow y_3)) \\
&\land (y_3 \Leftrightarrow \lnot x_4) \\
&\land (y_2 \Leftrightarrow (y_1 \Leftrightarrow x_3)) \\
&\land (y_1 \Leftrightarrow (x_1 \lor x_2)).
\end{aligned}
$$

The rest is fairly straightforward: we rewrite each equivalence as CNF using its truth table.

If you’re interested in more details, check out [this tutorial](https://rbcborealis.com/research-blogs/tutorial-9-sat-solvers-i-introduction-and-applications/).
