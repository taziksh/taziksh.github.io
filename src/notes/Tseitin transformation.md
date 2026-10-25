---
title: Tseitin transformation
date: 2026-10-25
public: true
---

Working through the example in [Borealis’s introduction to SAT solvers](https://rbcborealis.com/research-blogs/tutorial-9-sat-solvers-i-introduction-and-applications/), equations 3–7.

The formula we want to convert to conjunctive normal form is:

$$
\phi := ((x_1 \lor x_2) \Leftrightarrow x_3) \Rightarrow (\lnot x_4).
$$

**Step 1.** Introduce variables for the subexpressions, working from the inside out:

$$
\begin{aligned}
y_1 &\Leftrightarrow (x_1 \lor x_2) \\
y_2 &\Leftrightarrow (y_1 \Leftrightarrow x_3) \\
y_3 &\Leftrightarrow \lnot x_4 \\
y_4 &\Leftrightarrow (y_2 \Rightarrow y_3).
\end{aligned}
$$

**Step 2.** Require the output $y_4$ to be true, along with each definition:

$$
\begin{aligned}
C := {} & y_4 \\
&\land (y_4 \Leftrightarrow (y_2 \Rightarrow y_3)) \\
&\land (y_3 \Leftrightarrow \lnot x_4) \\
&\land (y_2 \Leftrightarrow (y_1 \Leftrightarrow x_3)) \\
&\land (y_1 \Leftrightarrow (x_1 \lor x_2)).
\end{aligned}
$$

**Step 3.** Rewrite each definition using the corresponding CNF recipe:

$$
\begin{aligned}
a \Leftrightarrow \lnot b
&\equiv (a \lor b) \land (\lnot a \lor \lnot b) \\[0.8em]
a \Leftrightarrow (b \lor c)
&\equiv (a \lor \lnot b) \land (a \lor \lnot c) \\
&\quad \land (\lnot a \lor b \lor c) \\[0.8em]
a \Leftrightarrow (b \land c)
&\equiv (\lnot a \lor b) \land (\lnot a \lor c) \\
&\quad \land (a \lor \lnot b \lor \lnot c) \\[0.8em]
a \Leftrightarrow (b \Rightarrow c)
&\equiv (a \lor b) \land (a \lor \lnot c) \\
&\quad \land (\lnot a \lor \lnot b \lor c) \\[0.8em]
a \Leftrightarrow (b \Leftrightarrow c)
&\equiv (\lnot a \lor \lnot b \lor c) \\
&\quad \land (\lnot a \lor b \lor \lnot c) \\
&\quad \land (a \lor \lnot b \lor \lnot c) \\
&\quad \land (a \lor b \lor c).
\end{aligned}
$$

Substituting gives:

$$
\begin{aligned}
C := {} & y_4 \\
&\land (y_4 \lor y_2) \land (y_4 \lor \lnot y_3) \\
&\land (\lnot y_4 \lor \lnot y_2 \lor y_3) \\[0.5em]
&\land (y_3 \lor x_4) \land (\lnot y_3 \lor \lnot x_4) \\[0.5em]
&\land (\lnot y_2 \lor \lnot y_1 \lor x_3) \\
&\land (\lnot y_2 \lor y_1 \lor \lnot x_3) \\
&\land (y_2 \lor \lnot y_1 \lor \lnot x_3) \\
&\land (y_2 \lor y_1 \lor x_3) \\[0.5em]
&\land (y_1 \lor \lnot x_1) \land (y_1 \lor \lnot x_2) \\
&\land (\lnot y_1 \lor x_1 \lor x_2).
\end{aligned}
$$

This is CNF: an AND of clauses, each an OR of literals. The extra variables preserve satisfiability: $\phi(x) \Leftrightarrow \exists y_1,y_2,y_3,y_4\; C(x,y)$.
