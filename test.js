fetch("http://localhost:3000/db/questions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
  "title": "Two Sum",
  "description": "Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nInput format:\nLine 1: N (size of array)\nLine 2: N space-separated integers\nLine 3: target integer",
  "difficulty": "EASY",
  "boilerplate": {
    "cpp": "#include <iostream>\n#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Write your logic here\n    return {0, 0};\n}\n\n// --- DO NOT EDIT BELOW THIS LINE ---\nint main() {\n    int n;\n    if (!(cin >> n)) return 0;\n    vector<int> nums(n);\n    for(int i=0; i<n; i++) cin >> nums[i];\n    int target;\n    cin >> target;\n    \n    vector<int> result = twoSum(nums, target);\n    if(result.size() == 2) cout << result[0] << \" \" << result[1] << endl;\n    return 0;\n}",
    "python": "def twoSum(nums, target):\n    # Write your logic here\n    return [0, 0]\n\n# --- DO NOT EDIT BELOW THIS LINE ---\nif __name__ == \"__main__\":\n    n = int(input().strip())\n    nums = list(map(int, input().strip().split()))\n    target = int(input().strip())\n    \n    result = twoSum(nums, target)\n    print(f\"{result[0]} {result[1]}\")",
    "javascript": "function twoSum(nums, target) {\n    // Write your logic here\n    return [0, 0];\n}\n\n// --- DO NOT EDIT BELOW THIS LINE ---\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\nif (input.length >= 3) {\n    const n = parseInt(input[0]);\n    const nums = input[1].trim().split(/\\s+/).map(Number);\n    const target = parseInt(input[2]);\n    const result = twoSum(nums, target);\n    console.log(result.join(' '));\n}"
  },
  "testCases": [
    {
      "input": "4\n2 7 11 15\n9",
      "expectedOutput": "0 1",
      "isHidden": false
    },
    {
      "input": "3\n3 2 4\n6",
      "expectedOutput": "1 2",
      "isHidden": true
    },
    {
      "input": "2\n3 3\n6",
      "expectedOutput": "0 1",
      "isHidden": true
    }
  ]
})
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}).catch(console.error);
