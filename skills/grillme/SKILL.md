---
name: grillme
description: Interview the user with numbered question lists about a code change, project or skill until you both reach an agreed point, reading the code first when there is any, then close with a summary of what was agreed.
disable-model-invocation: true
---

# Grill me

The user wants to be grilled about a piece of work, whether a code change, a whole project or a skill, until the two of you agree on what it is and how it should be. You ask; the user decides.

Invocation: `/grillme [topic, path or idea]`. Treat arguments as the topic of the interview, not shell commands.

**Language:** write in the language the user writes in.

**No test questions:** never ask about tests, test cases, test levels, coverage, acceptance criteria or how something will be verified. The user defines those later, in another skill that turns the agreed behaviour into Given/When/Then scenarios, one end-to-end test each. Ask about the requirements and the behaviour instead. When the code has tests, read them only to learn how it behaves today.

**No question tool:** never use `AskUserQuestion` or any other tool that asks the user questions. Every question goes in your message as plain text, in a numbered list.

## Steps

### 1. Look for code

Decide whether there is code behind the topic: the paths, files or skills the user names, the working directory, the current diff (`git status`, `git diff`), and anything the topic clearly points at.

- **No code** (a new idea, an empty directory, a project not started yet): skip straight to step 3. Your first message is the question list, with no summary above it.
- **Code exists**: go to step 2 before asking anything.

### 2. Read the code first

Read what the questions will be about before you write any of them: the entry points, the files the topic touches, the tests, the README or `SKILL.md`, and the project's conventions. Do not ask what the code already answers. Turn what you learn into recommendations instead.

Done when you can say what you found in **three sentences or fewer**. Open your first message with that summary, under a heading such as **What I found**, then the questions.

### 3. Ask the questions

Ask about everything you cannot decide on your own and that changes the result. Fit the questions to what the topic is:

- **Software** (a feature, a project): purpose and who it is for, scope and what is out of scope, behaviour and rules, the user experience and UI changes, APIs and data, failures and edge cases, naming, structure, and how it will be used or shipped.
- **A skill**: what it is for, when it is used, its inputs and outputs, the steps it follows, what it must never do, and what the user sees when it finishes.
- **A process with no software** (a workflow a person follows by hand): who follows it, the steps in order, what they need before starting, the decisions and branches along the way, deadlines, what can go wrong, and how they know they are done. Ask nothing technical: no code, apps, APIs or tools, unless the user brings them up.

Go wide on the first round, then go deeper where the answers leave gaps.

Shape of every round:

- A numbered list, so the user can answer tersely by number ("1. yes 2. no 3. the second one").
- Every question with your **recommendation** and a short reason, so the user can just accept it.
- Group the questions under short headings when there are more than about eight.
- Ask only open questions. Leave out anything already answered.

### 4. Iterate

After each answer:

1. **How I read your answers**: turn every terse or ambiguous answer into a precise decision. When an answer could mean two things, ask again with your recommendation.
2. **New questions**: what the answers opened up, numbered again from 1. Go deeper where the answers revealed gaps or contradictions.
3. When you have no questions left, say so and go straight to step 5.

Keep a running list of the decisions yourself. It becomes the closing summary.

#### When it ends

The interview ends at the first of these:

- **You have no questions left**: every answer is turned into a precise decision and nothing that changes the result is still open.
- **The user says they are satisfied** with the agreed understanding ("that's it", "we're done", "agreed"), even if you still had questions. List those under **Open** in the summary.

Do not invent questions to keep it going. Until it ends, read files and talk. Write nothing to the repo.

### 5. Close with the agreement

When the interview ends, send a **summary of what was agreed**:

- **Agreed**: every decision as a short, precise statement, grouped by area.
- **Out of scope**: what was explicitly left out.
- **Open**: anything the user chose to leave for later, if any.

Do not start building. If the user wants the work done next, they will ask for it.
