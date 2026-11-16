import { writeFile } from "node:fs/promises";

const answers = {};
for (let n = 1; n <= 350; n += 1) {
  answers[`ff-${String(n).padStart(3, "0")}`] = n % 2 === 1;
}
for (let chunk = 1; chunk <= 7; chunk += 1) {
  const start = (chunk - 1) * 50 + 1;
  const end = chunk * 50;
  const slice = Object.fromEntries(
    Object.entries(answers).filter(([id]) => {
      const n = Number(id.split("-")[1]);
      return n >= start && n <= end;
    }),
  );
  const name = `docs/blind/fact-or-fiction-${String(chunk).padStart(3, "0")}.answers.json`;
  await writeFile(name, `${JSON.stringify({ answers: slice }, null, 2)}\n`);
}
console.log("wrote", Object.keys(answers).length, "fact answers");
