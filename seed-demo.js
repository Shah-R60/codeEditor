const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config();

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const demoQuestions = [
  {
    title: "Two Sum",
    description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
    difficulty: "EASY",
    boilerplate: {
      python: "def two_sum(nums, target):\n    # Write your code here\n    pass\n\nif __name__ == '__main__':\n    n = int(input())\n    nums = list(map(int, input().split()))\n    target = int(input())\n    result = two_sum(nums, target)\n    print(*result)",
      javascript: "function twoSum(nums, target) {\n    // Write your code here\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\nconst n = parseInt(input[0]);\nconst nums = input[1].split(' ').map(Number);\nconst target = parseInt(input[2]);\nconsole.log(twoSum(nums, target).join(' '));",
      cpp: "#include <iostream>\n#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Write your code here\n    return {};\n}\n\nint main() {\n    int n, target;\n    cin >> n;\n    vector<int> nums(n);\n    for(int i=0; i<n; i++) cin >> nums[i];\n    cin >> target;\n    vector<int> result = twoSum(nums, target);\n    if(result.size() == 2) cout << result[0] << \" \" << result[1];\n    return 0;\n}"
    },
    testCases: [
      { input: "4\n2 7 11 15\n9", expectedOutput: "0 1", isHidden: false },
      { input: "3\n3 2 4\n6", expectedOutput: "1 2", isHidden: false },
      { input: "2\n3 3\n6", expectedOutput: "0 1", isHidden: true }
    ]
  },
  {
    title: "FizzBuzz",
    description: "Write a program that outputs the string representation of numbers from 1 to `n`.\n\nBut for multiples of three it should output “Fizz” instead of the number and for the multiples of five output “Buzz”. For numbers which are multiples of both three and five output “FizzBuzz”.",
    difficulty: "EASY",
    boilerplate: {
      python: "def fizz_buzz(n):\n    # Write your code here\n    pass\n\nif __name__ == '__main__':\n    n = int(input())\n    result = fizz_buzz(n)\n    for r in result:\n        print(r)",
      javascript: "function fizzBuzz(n) {\n    // Write your code here\n}\n\nconst fs = require('fs');\nconst n = parseInt(fs.readFileSync(0, 'utf-8').trim());\nconst result = fizzBuzz(n);\nif(result) result.forEach(r => console.log(r));",
      cpp: "#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\nvector<string> fizzBuzz(int n) {\n    // Write your code here\n    return {};\n}\n\nint main() {\n    int n;\n    cin >> n;\n    vector<string> result = fizzBuzz(n);\n    for(const string& s : result) cout << s << \"\\n\";\n    return 0;\n}"
    },
    testCases: [
      { input: "3", expectedOutput: "1\n2\nFizz", isHidden: false },
      { input: "5", expectedOutput: "1\n2\nFizz\n4\nBuzz", isHidden: false },
      { input: "15", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz", isHidden: true }
    ]
  }
];

async function seed() {
  console.log("Seeding Demo Questions...");
  
  // Clear existing demo questions
  await prisma.demoQuestion.deleteMany({});
  
  for (const q of demoQuestions) {
    const created = await prisma.demoQuestion.create({
      data: {
        title: q.title,
        description: q.description,
        difficulty: q.difficulty,
        boilerplate: q.boilerplate,
        testCases: {
          create: q.testCases
        }
      }
    });
    console.log(`Created Demo Question: ${created.title}`);
  }

  console.log("Demo Seeding Complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
