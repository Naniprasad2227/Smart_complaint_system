from predict import DEFAULT_RESPONSE, MODEL_BUNDLE, clean_text, rule_based_fallback


def classify_complaint(text: str):
    normalized_text = clean_text(text)

    if not normalized_text:
        return DEFAULT_RESPONSE

    if not MODEL_BUNDLE:
        return rule_based_fallback(normalized_text)

    category_model = MODEL_BUNDLE['category_model']
    category_meta = MODEL_BUNDLE.get('category_meta', {})

    predicted_category = category_model.predict([normalized_text])[0]
    meta = category_meta.get(predicted_category, {})

    return {
        'category': predicted_category,
        'priority': meta.get('priority', 'Medium'),
        'department': meta.get('department', 'General Operations'),
        'sentiment': meta.get('sentiment', 'Neutral'),
    }


__all__ = ['classify_complaint']