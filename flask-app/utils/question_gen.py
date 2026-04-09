import requests
import json
import random

OLLAMA_URL = "http://localhost:11434"


def check_ollama():
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        if resp.status_code == 200:
            models = resp.json().get('models', [])
            return len(models) > 0
    except Exception:
        pass
    return False


def get_available_models():
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        if resp.status_code == 200:
            return [m['name'] for m in resp.json().get('models', [])]
    except Exception:
        pass
    return []


def build_prompt(content, question_type, difficulty, count, style_samples=None):
    diff_map = {
        'easy': '쉬움 (기본 개념 확인)',
        'medium': '보통 (개념 적용 및 이해)',
        'hard': '어려움 (심화 사고 및 분석)'
    }
    diff_text = diff_map.get(difficulty, '보통')

    type_instruction = ""
    if question_type == 'multiple_choice':
        type_instruction = "객관식 문제를 생성하세요. 각 문제에 4개의 보기(①②③④)를 포함하세요."
    elif question_type == 'short_answer':
        type_instruction = "서술형 문제를 생성하세요. 보기 없이 서술형으로 답할 수 있는 문제를 만드세요."
    else:
        type_instruction = "객관식과 서술형을 혼합하여 문제를 생성하세요. 객관식은 4개의 보기(①②③④)를 포함하세요."

    style_text = ""
    if style_samples:
        style_text = "\n\n[참고: 사용자가 선호하는 문제 스타일 예시]\n"
        for s in style_samples[:3]:
            style_text += f"- {s}\n"

    prompt = f"""다음 과학 교재 내용을 바탕으로 {count}개의 문제를 생성하세요.

[조건]
- 난이도: {diff_text}
- {type_instruction}
- 각 문제에 정답과 해설을 반드시 포함하세요.
- 개념 이해를 확인하는 문제를 중심으로 출제하세요.
{style_text}

[교재 내용]
{content[:3000]}

[출력 형식 - 반드시 JSON 배열로 출력]
[
  {{
    "type": "multiple_choice" 또는 "short_answer",
    "question": "문제 내용",
    "choices": ["①보기1", "②보기2", "③보기3", "④보기4"] 또는 null,
    "answer": "정답",
    "explanation": "해설"
  }}
]

JSON 배열만 출력하고 다른 텍스트는 포함하지 마세요."""

    return prompt


def generate_with_ollama(prompt, model=None):
    if not model:
        models = get_available_models()
        model = models[0] if models else "llama3"

    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.7}
            },
            timeout=120
        )
        if resp.status_code == 200:
            text = resp.json().get('response', '')
            return parse_questions(text)
    except Exception as e:
        print(f"Ollama error: {e}")

    return None


def parse_questions(text):
    text = text.strip()

    start = text.find('[')
    end = text.rfind(']')
    if start != -1 and end != -1:
        json_str = text[start:end + 1]
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    return None


def generate_demo_questions(content, question_type, difficulty, count):
    questions = []
    keywords = []
    for word in content.split():
        cleaned = word.strip('.,!?()[]{}')
        if len(cleaned) >= 2 and not cleaned.isdigit():
            keywords.append(cleaned)

    if len(keywords) < 5:
        keywords = ["과학", "원리", "실험", "관찰", "결과", "현상", "법칙", "에너지", "물질", "변화"]

    random.shuffle(keywords)

    mc_templates = [
        ("다음 중 {kw}에 대한 설명으로 옳은 것은?",
         ["①{kw}은(는) 물리적 변화에 해당한다",
          "②{kw}은(는) 화학적 변화에 해당한다",
          "③{kw}은(는) 에너지 보존 법칙에 따른다",
          "④{kw}은(는) 질량 보존 법칙과 무관하다"],
         "③{kw}은(는) 에너지 보존 법칙에 따른다",
         "{kw}은(는) 에너지 보존 법칙에 따라 에너지가 전환되거나 보존됩니다."),
        ("{kw}의 특징으로 옳지 않은 것은?",
         ["①일정한 규칙성을 가진다",
          "②외부 조건에 영향을 받을 수 있다",
          "③과학적 방법으로 검증할 수 있다",
          "④항상 동일한 결과만 나타난다"],
         "④항상 동일한 결과만 나타난다",
         "{kw}은(는) 다양한 조건에 따라 다른 결과가 나타날 수 있으므로, 항상 동일한 결과만 나타난다는 설명은 옳지 않습니다."),
        ("{kw}과(와) 관련된 실험에서 가장 중요한 요소는?",
         ["①실험 장비의 크기",
          "②변인 통제",
          "③실험 장소",
          "④실험자의 경력"],
         "②변인 통제",
         "과학 실험에서 {kw}을(를) 정확히 관찰하려면 변인 통제가 가장 중요합니다."),
    ]

    sa_templates = [
        ("{kw}의 개념을 설명하고, 일상생활에서 볼 수 있는 예시를 2가지 제시하시오.",
         "{kw}은(는) 과학적 원리에 기반한 현상으로, 일상생활에서 다양하게 관찰됩니다. 예를 들어...",
         "{kw}에 대한 정확한 개념 정의와 함께 구체적인 일상 예시를 통해 이해도를 확인하는 문제입니다."),
        ("{kw}이(가) 변화하는 과정을 단계별로 서술하시오.",
         "{kw}의 변화 과정: 1단계 - 초기 상태 확인, 2단계 - 조건 변화 적용, 3단계 - 결과 관찰 및 분석",
         "과정을 순서대로 설명할 수 있는지 확인하는 문제입니다. 논리적 사고력을 평가합니다."),
        ("{kw}에 대한 가설을 세우고, 이를 검증하기 위한 실험 방법을 설계하시오.",
         "가설: {kw}은(는) 특정 조건에서 변화한다. 실험: 변인을 통제하고 대조군과 실험군을 설정하여 비교한다.",
         "과학적 탐구 과정(가설 설정 → 실험 설계)을 이해하고 있는지 평가하는 문제입니다."),
    ]

    for i in range(count):
        kw = keywords[i % len(keywords)]
        
        if question_type == 'multiple_choice':
            use_mc = True
        elif question_type == 'short_answer':
            use_mc = False
        else:
            use_mc = (i % 2 == 0)

        if use_mc:
            template = mc_templates[i % len(mc_templates)]
            questions.append({
                "type": "multiple_choice",
                "question": template[0].format(kw=kw),
                "choices": [c.format(kw=kw) for c in template[1]],
                "answer": template[2].format(kw=kw),
                "explanation": template[3].format(kw=kw)
            })
        else:
            template = sa_templates[i % len(sa_templates)]
            questions.append({
                "type": "short_answer",
                "question": template[0].format(kw=kw),
                "choices": None,
                "answer": template[1].format(kw=kw),
                "explanation": template[2].format(kw=kw)
            })

    return questions


def generate_questions(content, question_type, difficulty, count, style_samples=None):
    if check_ollama():
        prompt = build_prompt(content, question_type, difficulty, count, style_samples)
        result = generate_with_ollama(prompt)
        if result:
            return result, False

    return generate_demo_questions(content, question_type, difficulty, count), True


def regenerate_single_question(content, question_type, difficulty, style_samples=None):
    questions, is_demo = generate_questions(content, question_type, difficulty, 1, style_samples)
    if questions:
        return questions[0], is_demo
    return None, True


def regenerate_choices_only(question_text, correct_answer, content):
    if check_ollama():
        prompt = f"""다음 문제의 오답 보기 3개를 새로 생성하세요. 정답은 유지하세요.

문제: {question_text}
정답: {correct_answer}
관련 내용: {content[:1000]}

[출력 형식 - JSON 배열]
["①보기1", "②보기2", "③보기3", "④보기4"]

정답을 포함하여 4개의 보기를 JSON 배열로만 출력하세요."""

        try:
            models = get_available_models()
            model = models[0] if models else "llama3"
            resp = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False},
                timeout=60
            )
            if resp.status_code == 200:
                text = resp.json().get('response', '')
                start = text.find('[')
                end = text.rfind(']')
                if start != -1 and end != -1:
                    choices = json.loads(text[start:end + 1])
                    if len(choices) == 4:
                        return choices
        except Exception:
            pass

    wrong_options = [
        f"①오답 보기 A (데모)",
        f"②오답 보기 B (데모)",
        f"③오답 보기 C (데모)",
    ]
    choices = wrong_options + [correct_answer]
    random.shuffle(choices)
    return choices
