# AI Usage Log

## Tools used

_Which assistants/agents/extensions, and roughly for what._

- Google Gemini over the web browser (as you would do to google about issues or checking stackoverflow)
- (I have Cline installed in vscode, but it was not needed).

## Representative prompts

_A handful of the actual prompts that did real work. Paste them._

rest api pagination strategies

## Where I accepted / rejected / corrected AI output

_Concrete examples: a suggestion you took as-is, one you rejected and why, one
you had to correct._

(Prompts are included in the following cases)

### Case 1

I used Gemini to quickly have a review on the refactoring of `findResources()` to use UNION queries based on the admin role.

> _prompt_: the file `resources.ts`, the query using `OR` and "There are a user roles in the system: admin and member. If role="admin", then it can see the owned resources and the shared, but if role="member", it can see only those owned by ownerId. Can you suggest a refactor to have that implementated?"

It allucinated about the ORDER (adding unrequested changes), adding options for multiple properties beyond `created_at`. I didn't accept his change (though I understood it would be a good idea to add defensive code on that matter). The suggested code was like this:

```
if (opts.orderBy) {
    const allowedColumns = ["id", "created_at", "updated_at", "title"];
    const cleanOrder = allowedColumns.includes(opts.orderBy)
      ? opts.orderBy
      : "id";
    sql += ` ORDER BY ${cleanOrder}`;
```

Also the suggested code included an input option in the `FindResourcesOpts` type called `includeSharedWithUserId: true`. I changed that for `role: "admin" | "member"` because it is closer to the domain.

The last change, small thought, is that the suggestion included the `buildSharedFilters()` inside the scope of `findResources()` with access to the values opt and params in the scope.

```
findResources(opts){
  params
  buildSharedFilters() {

  }
  buildSharedFilters();
}
```

But that makes buildSharedFilters() an impure function, so I changed it to the folling schema which is more maintainable, to have the function pure, standalone and testable indipendently:

```
findResources(opts){
  params
  buildSharedFilters(opts, params);
}

buildSharedFilters(opts, params) {
}
```

### CASE 2

While investigating about the query performance for the optiones mentions in _PR_DESCRIPTION.md_ in the PS section, I used Gemini to compare the outputs of the `EXPLAIN ANALYSE` and to understand from plain text the strategies that postgres was applying.

> _prompt:_ both of the outputs of `EXPLAIN ANALYSE` with each query and "Can you explain the performance of these queries?"

### CASE 3

Quick fixes for TS issues like:

```
Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '{ admin: { "x-user-id": string; "x-user-role": string; }; member: { "x-user-id": string; "x-user-role": string; }; }'.
  No index signature with a parameter of type 'string' was found on type '{ admin: { "x-user-id": string; "x-user-role": string; }; member: { "x-user-id": string; "x-user-role": string; }; }'.ts(7053)
```

> _prompt_: simply the error message pasted in the Gemini input.

## How I verified AI-generated code

_Especially **SQL** and **tests**: how did you confirm the queries return the
right rows and the tests actually test what they claim? (e.g. ran against
seed data, checked `EXPLAIN`, wrote a failing case first, manual `curl`.)_

- When I had the `findResources()` changes from Gemini, I found the above mentioned issue with the order as the test that checks that failed (`returns the latest resources in DESC order` in \_resources.test.ts).
  - Also I run the endpoint `/resources/recent` with postman and saw the order was not DESC.

- For the explanation performance of the `EXPLAIN ANALYSE` logs, I verified further reading [a cool article](https://blog.dataengineerthings.org/efficient-query-optimization-in-postgresql-leveraging-indexes-for-faster-sorting-grouping-and-2d3cc2817eab) to understand better how `OR` was working in the query
