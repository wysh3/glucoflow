# Interface language coverage

GlucoFlow stores interface translations in the client bundle. Changing the language makes no translation request. The selector stores the preference on the device, applies the language tag and reading direction to the document, and uses the selected locale for interface dates. Date-only values keep their calendar day, and recorded year and month precision are retained.

## Current scope

| Coverage | Languages | What is available |
|---|---|---|
| Base | English | English interface throughout |
| Patient workflow catalog | Hindi | Patient navigation, records, upload entry and wizard controls, visit note entry and review, Account labels, and shared loading and retry controls |
| Patient control preview | Assamese, Bengali, Gujarati, Kannada, Malayalam, Marathi, Nepali, Odia, Punjabi, Tamil, Telugu and Urdu | Patient navigation and selected record, upload entry, visit note and account controls. Other strings use English. |
| Listed for later translation | Bodo, Dogri, Kashmiri, Konkani, Maithili, Manipuri, Sanskrit, Santali and Sindhi | Language name, script tag and reading direction are recorded in the catalog. These languages are not offered in the interface selector. |

The catalog lists all 22 languages in India's Eighth Schedule and English separately. Script choices are specific to the available catalog and do not represent every written form of a language. [Government of India Eighth Schedule list](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/LS11022025/118.pdf)

The current static wording awaits human language and accessibility review. Clinic workspace content, search and chart tools, source views, server messages and clinical source material may remain in English. The upload wizard's main actions and fictional-data warning are available in Hindi. The interface explains the fallback when a translated locale is selected. Source documents, measurements, clinician statements and patient-entered text keep their original content. Generated assistant output and speech capability are separate from the static interface translations.

Voice input in Visit notes inserts recognized text into the editable draft. Sending still requires the existing review and send controls. Read aloud is available from the reviewed draft when the configured speech service supports it.

## Verification

Catalog checks validate language tags, the Hindi key and interpolation match, partial fallback, and date precision. Chromium checks exercise Hindi preference persistence, patient navigation, note preview and edit, and Urdu right-to-left layout at desktop and mobile widths. They use synthetic accounts and do not send a note or call a translation service.
