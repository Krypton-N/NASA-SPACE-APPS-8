"""Conversational layer: it may rephrase and judge, never bring new values or names."""

from types import SimpleNamespace

from nasa_fire_ai.services.interpretation import fact_base, guard, interpret

RESPONSE = {
    "answer": "The ZELTA-7 trial used Qorvex foam at 31.6 kPa. [1] The MIRO-B run lasted 412 s. [2]",
    "citations": [
        {
            "number": 1,
            "text": "ZELTA-7 burned Qorvex foam at 31.6 kPa.",
            "source": {"title": "Report A"},
        },
        {
            "number": 2,
            "text": "MIRO-B lasted 412 s in the glovebox.",
            "source": {"title": "Report B"},
        },
    ],
    "generation_status": {"explanation_status": "VERIFIED_PROSE"},
}


class FakeProvider:
    generation_name = "Fake model"

    def __init__(self, answer):
        self.answer = answer
        self.calls = []

    def request(self, stage, system, payload, max_tokens):
        self.calls.append((stage, payload))
        return {"answer": self.answer, "language": "es"}


def run(answer):
    request = SimpleNamespace(message="¿Cuál es el experimento más raro?")
    return interpret(FakeProvider(answer), request, RESPONSE, [])


def test_judgement_over_verified_facts_is_accepted_in_another_language():
    out = run("En mi lectura, el más inusual es ZELTA-7: usó espuma Qorvex a 31,6 kPa [1].")
    assert out["status"] == "ACCEPTED"
    assert "ZELTA-7" in out["text"] and "[1]" in out["text"]
    assert out["generated_by"] == "Fake model"


def test_sentence_with_a_new_value_is_dropped():
    out = run("ZELTA-7 usó espuma Qorvex [1]. Además alcanzó 977 K [2].")
    assert out["status"] == "PARTIAL"
    assert "977" not in out["text"] and "Qorvex" in out["text"]
    assert out["dropped"][0]["reasons"] == ["value 977"]


def test_sentence_with_an_unknown_experiment_name_is_dropped():
    out = run("El más raro es TOLVA-X, que nadie más hizo.")
    assert out["status"] == "REJECTED" and out["text"] == ""
    assert out["dropped"][0]["reasons"] == ["name TOLVA-X"]


def test_markers_that_point_to_no_citation_are_removed():
    text, dropped = guard("MIRO-B duró 412 s [2][9].", fact_base(RESPONSE), {1, 2})
    assert text == "MIRO-B duró 412 s [2]." and not dropped


def test_provider_failure_keeps_the_verified_answer_path_alive():
    class Broken(FakeProvider):
        def request(self, *args):
            raise RuntimeError("down")

    out = interpret(Broken(""), SimpleNamespace(message="q"), RESPONSE, [])
    assert out["status"] == "UNAVAILABLE" and out["text"] == ""


def test_no_provider_means_no_interpretation():
    assert interpret(None, SimpleNamespace(message="q"), RESPONSE, []) is None
