from flask import Flask, request, jsonify
from openai import OpenAI
import os

app = Flask(__name__)

client = OpenAI(api_key="여기에_API키")

@app.route("/generate", methods=["POST"])
def generate():
    data = request.json
    prompt = data.get("prompt")

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "너는 과학 문제를 만드는 교사야. 반드시 JSON만 출력해."},
            {"role": "user", "content": prompt}
        ]
    )

    result = response.choices[0].message.content

    return jsonify({"result": result})

app.run(debug=True)
