# **SwarSathi: Full technical architecture map**

I would change the way we define the product before choosing another model or library.

SwarSathi should not be a text-to-speech app. It should be a universal communication and accessibility layer for Android.

Its job is to help a person communicate in either direction, regardless of whether they can speak, hear, read, type, or use conventional touch interaction.

That means supporting several different situations:

* A person who cannot speak but can hear.  
* A person who is deaf or hard of hearing but can speak.  
* A person who is both deaf and non-speaking.  
* A person with temporary speech or hearing loss.  
* A person with limited literacy, motor control, or language fluency.  
* A person who can communicate in one language but needs help communicating in another.

The product should adapt to the person's abilities and preferred communication methods—not force everyone through the same text box.

My engineering principle: build the accessibility layer once, then connect multiple open-source engines to it. Don't build the entire AI stack from scratch, and don't make the product dependent on a paid API.

## **1\. The product map: what SwarSathi must eventually do**

Think of SwarSathi as six connected communication systems.

SWAR SATHI — COMMUNICATION CORE

One user profile · multiple ways to communicate · privacy-first

1\. Understand speech

Live captions, transcription, speaker labels, speech translation

2\. Express thoughts

AAC, text-to-speech, phrases, symbols, personalised voices

3\. Sign communication

Indian Sign Language support, visual signing tools, text conversion

4\. Understand surroundings

Doorbell, alarms, sirens, crying, knocks, important sounds

5\. Cross-language communication

Indian languages, translation, transliteration, mixed-language input

6\. Accessibility interface

Visual alerts, haptics, large controls, switch access, alternative input

Shared intelligence and personalisation layer

Language detection · user vocabulary · voice profiles · preferences · context · offline model manager

The critical design decision: these must be independent modules sharing one communication core. A user should not need to open five different apps to communicate.

## **2\. What to copy, study and integrate**

I would not reinvent mature research. I would reuse proven engines, model architectures, datasets and open-source projects, subject to their individual licences.

### **A. Speech recognition: what someone says → readable text**

[Application mobile](https://images.openai.com/static-rsc-4/fF3moT-X5S1hRqfLnKjwSfteXtONtWTWWXpO3RhD8HF6bRaCKfYpneCBQ8beHNtky0-CjyPuvNoEQDwVBFZuf6r1O9-D871fCM9RHkLgTMeP64aUYDbWVfN_qUAtXU_E3mmulodBQnKM1Uix7ULlyHNp30nJDiNMZQhWTLkiW24?purpose=inline)

Primary toolkit: sherpa-onnx

Offline ASR, streaming recognition, VAD, speaker diarisation and Android deployment.

[GitHub repository](https://github.com/k2-fsa/sherpa-onnx?utm_source=chatgpt.com) · Apache 2.0

[ASR IndicConformer \- a Hugging Face Space by shubhankarAI](https://images.openai.com/static-rsc-4/G2ySJ3DIEhF66SZZvRSAusHNNJfthng8Qh29GRqAAKi_yltUeeTzQsa9yKgSUFTBFhdU7jDADlkHRuyikUWfBiqVtSXJ-ACQSXtXodOrv2RINqYt6litHVW-6tthCWsxD9Ms67Me8MV4fZ-8lmJ4SPVYHH7K6GiXvRolbf_Hl4Y?purpose=inline)

Indian language ASR: IndicConformer

AI4Bharat's 22-language ASR family. Particularly important for our Indian-language strategy.

[GitHub repository](https://github.com/AI4Bharat/IndicConformerASR?utm_source=chatgpt.com) · MIT

[Using OpenAI Whisper for Multi-Lingual ASR \| AI Tutorial \| Next Electronics](https://images.openai.com/static-rsc-4/Oo5Iwi9xfTllbmM2lS2E1tI1RWWfLR_i8owURU-8CtaKFhC1FWHfv_7-_iM1UmnQ5W91Cl5Exbqn1odGV2dgBiZKhescpo1785xNGbfWhWUsKlRqSy9BlTxytbkh1iZSdiUffFwijXPfvKFSTCr_uB3y5gTCN5NKsxhVs83REHw?purpose=inline)

Benchmark and alternative: Whisper

Useful for multilingual transcription, recorded audio and difficult speech. Test small and quantised variants on actual Android devices.

[GitHub repository](https://github.com/openai/whisper?utm_source=chatgpt.com)

What to build: live caption mode, large readable text, adjustable font, punctuation, speaker labels, editable transcript, and optional translation. The user must be able to correct recognition errors.

### **B. Text-to-speech: what someone types → their voice**

[What Is Kokoro-82M? Why It Fits Browser Text to Speech \| Resodock](https://images.openai.com/static-rsc-4/x6v-mNgYM_JOVt2AY-dAtkygrT3eMAavXg7uwJgQ50RkrZLoelWOH_LnKxyYVFMhbqEkuXldcFEzlWYmvGHTgVjj1DUgWvrmMpQJj9Ng2myOXHsIgfEY8ieLcRrz3NUTzaehjpzTZSjEoTPlLieIRWkaa7BIEnLu68K1eMzOrIU?purpose=inline)

Kokoro-82M

Lightweight neural TTS worth testing for natural voices and efficient inference. Language and voice coverage must be checked per model.

[GitHub repository](https://github.com/hexgrad/kokoro?utm_source=chatgpt.com)

[Ship Your First Local Voice with Piper, Then Make It Boring \| Mike CK \- Electrical Engineer and Developer](https://images.openai.com/static-rsc-4/1CRCgz-WRPpFBBS_lZQdXLwyWmTY20PAitisayw912K1GRZtVW5L7mUIwKH5tEeM_F-M7QZ_Q0kGTUIa4QNGIptF0DAnGLDvvzBTdU3UWurgbxlHJlqbTsLoh0aFcw8JLwSISiqJtFn_NuqyZwFNz_4UeM6zWdyrXsT_jMCH8ps?purpose=inline)

Piper

Efficient local neural TTS. Keep your existing sherpa-onnx/Piper foundation; check each voice model's licence and language quality.

[GitHub repository](https://github.com/rhasspy/piper?utm_source=chatgpt.com)

[Veena TTS (Maya) \| aicreators.tools](https://images.openai.com/static-rsc-4/qYbrMCNx5XHL06goBwFGZlAyd3U4cBicJ9g220Ua417HJrs1tRPu8TAIpwaRcAFVBrFHii3Wpz6bh-e5M_2n8GqdcVHE1H6hgax6Zr0I3LbD6_2p19jl6Iz-XgGPMwo-QhKbVyZd4728QAGUQ47aP-IcFQBwleWJmVKP-JU_jbU?purpose=inline)

Maya 2 Native

Worth testing now

A recently surfaced open-weight model for 11 Indian languages plus English, with streaming and multiple voices. Apache 2.0 is reported for its model and code. Evaluate its hardware requirements before considering mobile deployment.

[Model card](https://huggingface.co/maya-research/maya2-native?utm_source=chatgpt.com)

My recommendation: don't build 14 separate neural voices just because we want seven personas with male and female variants.

Build a voice persona system that maps a user's selected voice to available engines and supported controls:

* Friendly  
* Gentle  
* Confident  
* Expressive  
* Mature  
* Youthful  
* Clear

Store voice, speed, pitch, pronunciation dictionary and preferred language in a profile. A persona should never be advertised in a language unless the actual voice has passed quality testing in that language.

### **C. Translation and Indian language intelligence**

[IndicTrans2-M2M \| AI4Bharat Blog](https://images.openai.com/static-rsc-4/3H5PT8rvMF8tqhk2ra-UizoPh5r_DUxbBS2t6qkti6Oy4p7VCeGo1b5brObbCO7woyqPWKzkKLLDvonax6wq1hQIdBQYpK55gZoSQpxLwmR28dmBi2ZXMQ3Wi1wrU_Fhdis8W0tvMSWXu3e4GSMcCnnacf2mb2oZ91S82TNdpuU?purpose=inline)

IndicTrans2

One of the most important projects for SwarSathi. Open translation models covering all 22 scheduled Indian languages.

[GitHub repository](https://github.com/AI4Bharat/IndicTrans2?utm_source=chatgpt.com) · MIT model checkpoints

[GitHub \- AI4Bharat/IndicXlit: Transliteration models for 21 Indic languages · GitHub](https://images.openai.com/static-rsc-4/1z_eku_CpCFY1LAyVdJNrrQrFV25ygAofjfnah3lDxTzR5u1NFh2UWrceBb5kj6_f25kHm-J7O-m1I5pqCLyzTxbdR3a6LdXSMKS2v9VLzK4dncQ2S_5mgwB1ZUyAS4ed7X7POQ1pa4XEIwRW0n4n0P9q2AedhCnZVoNwdWioPQ?purpose=inline)

IndicXlit

Roman-to-native-script transliteration across many Indian languages. Useful when someone types Malayalam or Hindi using English letters.

[AI4Bharat model catalogue](https://models.ai4bharat.org/?utm_source=chatgpt.com)

The language engine should have independent capabilities:

1. Detect language.  
2. Convert Roman typing into native script.  
3. Translate between languages.  
4. Preserve names and common phrases.  
5. Generate speech in the target language.  
6. Handle code-switching—such as Malayalam mixed with English.

Do not make a language available just because translation works. Translation, ASR, TTS and pronunciation are separate capabilities.

models.ai4bharat.org+2

### **D. Sound awareness: help a deaf or hard-of-hearing person understand their environment**

[iPhone Sound Recognition might just be the coolest feature of iOS 16 \| Creative Bloq](https://images.openai.com/static-rsc-4/WYMU2EymZ0moNfnlnHsdeUkhTtYL2-QHqqUK2dnDdLm3Mw3ceSMqMOE22bZxCRbl5F6qcNyDde6HA5_0b4X9hqVc11vi8nw0IJj4zebfhV2hdF65-oaYB5Z2TTg5wHhyQ3gj6zv7UjHjGQzNhp_R9ASlDbn5FDKc1ByolYW8D68?purpose=inline)

Study: YAMNet and LiteRT

Classify environmental audio locally. Start with doorbells, knocks, alarms, sirens, smoke alarms, dog barking and crying.

[TensorFlow models](https://github.com/tensorflow/models?utm_source=chatgpt.com)

An interesting reference is [SwarSware](https://github.com/harissabil/SwarSware?utm_source=chatgpt.com), an Android project that uses YAMNet for on-device environmental sound alerts.

GitHub

Build this as a separate Sound Awareness feature:

* Recognise a sound.  
* Display a clear visual alert.  
* Trigger a distinct vibration pattern.  
* Flash the screen or camera light where supported and permitted.  
* Let the user choose which sounds matter.  
* Provide a history of detected events.

Important: sound classification is not a certified smoke alarm or emergency system. Never position it as a replacement for safety equipment.

### **E. Indian Sign Language**

This is where I would be ambitious—but careful.

[Visit Delhi's cafe run by deaf people – DW – 11/18/2022](https://images.openai.com/static-rsc-4/OtFz-mv6JK7CuBDDqbgcrY5wcZbPnuGM4_eWRyR-C_wl7Eu-1GtKRXu15KotHlqiaHtwid8_VZp-L0Os8A2DTsxVLgk3F9JHK_Ths6zGwP_1r4nIzR3nJfsTBm7PoSqfoeanPnPY84zEo6Ky-3lWoJuX8VjKDgsy49T-7qquU5s?purpose=inline)

Study: ISLiM

A recent research framework for Indian Sign Language translation using body-pose keypoints. It reports an early Android deployment study, but its reported translation performance is still far from sufficient for a dependable consumer product.

[GitHub repository](https://github.com/ahmedshoaib/ISLiM?utm_source=chatgpt.com) · [Research paper](https://aclanthology.org/2026.wslp-1.3/?utm_source=chatgpt.com)

Sign language is not simply hand gestures mapped to words. It has grammar, facial expression, movement, spatial structure and regional variation.

My approach:

* First: an ISL learning/reference library made with Deaf community partners.  
* Second: frequently used signed phrases and visual communication cards.  
* Third: camera-based recognition for a small, clearly defined vocabulary.  
* Fourth: continuous sign-to-text research.  
* Later: text-to-sign avatar or video generation, only with native signers validating the output.

Do not market a small gesture classifier as a universal sign-language translator.

IEEE Xplore+1

## **3\. The actual engineering architecture**

You already have a working React Native / TypeScript, Expo, Kotlin, SQLite and Zustand foundation, with Android TTS and sherpa-onnx/Piper. Preserve it. We should extend the architecture, not rewrite a functioning application.

This is the architecture I would build around it:

SWARSATHI ANDROID APP

React Native · TypeScript · Accessible UI · Zustand

Communication Studio

Compose · AAC · phrases

Live Conversation

Captions · transcripts

Sign & Visual

ISL tools · visual cards

Sound Awareness

Sound events · haptics

Language Centre

Translate · transliterate

Personal Voice

Voice profiles · vocabulary

COMMUNICATION ORCHESTRATOR

Routes each task to the best available local engine

Speech engines

ASR · TTS · VAD · diarisation · sound detection

Language engines

Translation · transliteration · language ID

Vision engines

Pose · hand landmarks · sign recognition

Accessibility engines

Haptics · screen flash · switch access

LOCAL DATA AND MODEL LAYER

SQLite · model files · profile settings · vocabulary · encrypted local storage

Internet is optional. Core communication must continue without an account or cloud connection.

### **The most important architectural decision: engine adapters**

Never allow a screen to depend directly on Piper, Whisper, IndicConformer or any specific model.

Create provider-independent interfaces:

```
interface SpeechToTextEngine {
  initialize(config: ModelConfig): Promise<void>;
  start(options: ASROptions): Promise<void>;
  stop(): Promise<Transcript>;
  onPartialResult(callback: (text: string) => void): void;
}

interface TextToSpeechEngine {
  initialize(config: ModelConfig): Promise<void>;
  speak(text: string, options: VoiceOptions): Promise<void>;
  stop(): Promise<void>;
  getCapabilities(): Promise<EngineCapabilities>;
}

interface TranslationEngine {
  translate(
    text: string,
    source: string,
    target: string
  ): Promise<TranslationResult>;
}

interface SoundDetectionEngine {
  start(): Promise<void>;
  onDetection(callback: (event: SoundEvent) => void): void;
  stop(): Promise<void>;
}
```

These are illustrative contracts, not a request to replace your existing interfaces blindly.

Then build adapters:

| Adapter | Candidate implementation |
| ----- | ----- |
| Android native TTS | Android TextToSpeech |
| Neural TTS | sherpa-onnx / Piper / Kokoro |
| Indian TTS | Evaluate Maya 2 Native and AI4Bharat |
| Speech recognition | sherpa-onnx / IndicConformer |
| Recorded audio transcription | Whisper-family models |
| Translation | IndicTrans2 |
| Transliteration | IndicXlit |
| Sound detection | YAMNet / LiteRT |
| Sign recognition | MediaPipe landmarks \+ research models |

The sherpa-onnx project is especially useful because it already provides a common offline inference layer for multiple speech functions and platforms.

GitHub+1

Why this matters: if a better model appears next month, we replace an adapter or model package—not the entire application.

## **4\. The user experience should be built around communication situations**

I would stop organising the product primarily around technical features such as TTS and ASR.

Organise it around what the person is trying to do.

SwarSathi — Home concept

Concept

# **How would you like to communicate?**

Choose a communication method. You can use more than one.

I want to express

Type, select symbols, phrases or speak through a voice.

I want to understand

Live captions, transcripts and translation.

I use sign language

Sign resources and visual communication.

I want to notice sounds

Visual and vibration alerts for important sounds.

I need translation

Communicate across languages.

Personalise my access

Text size, controls, voice, haptics and preferences.

Illustrative information architecture, not a finished screen design.

### **Essential features by communication journey**

| User situation | SwarSathi experience |
| ----- | ----- |
| Non-speaking person talking to someone | Type / select phrase → speech or audio message |
| Deaf person talking to a hearing person | Microphone → large live captions |
| Deaf person communicating with a non-speaking person | Text, visual cards and optional speech output |
| Deaf and non-speaking person | Text, AAC, sign resources and visual interaction |
| Person who struggles with typing | Phrase boards, predictive vocabulary, symbols, switch access |
| Person communicating in another language | Transcribe → translate → display or speak |
| Person who cannot hear a warning | Sound detection → vibration / visual alert |

One feature I particularly want: two-way conversation mode.

A hearing person speaks; their words appear on one side. The other person types, selects a phrase or signs; their response appears on the other side and can optionally be spoken aloud.

This is much more useful in a real conversation than having separate ASR and TTS screens.

## **5\. Build the AI layer carefully**

We should use LLMs, but we should not put an LLM in the middle of every communication action.

A person pressing "I need water" should not wait for an LLM to interpret the sentence.

Use conventional deterministic code for:

* Phrase selection.  
* TTS playback.  
* Saved messages.  
* Emergency phrases.  
* Navigation.  
* Voice selection.  
* Offline operation.

Use AI where it genuinely improves expression:

* Correcting dictated text.  
* Simplifying a sentence.  
* Suggesting a clearer phrase.  
* Translating conversational language.  
* Predicting likely next phrases.  
* Personalising vocabulary based on explicit user choices.

### **What to use for local language intelligence**

Study quantised small models such as Qwen-family and Gemma-family open-weight models for optional local text assistance. But verify each exact model's licence, supported hardware, quantisation, memory and commercial-use terms before bundling.

My recommendation is to build an LLM provider adapter, not make a specific LLM mandatory.

The model should never silently change the user's intended meaning. Show suggested text, let the user approve it, and provide a direct route to send the original.

### **Personal voice identity**

This is a long-term differentiator.

A person's voice is part of their identity. A person who loses their ability to speak may want to preserve the voice they had before.

Build this in stages:

1. Select a voice from the local library.  
2. Personalise pronunciation, pace and pitch.  
3. Save a personal vocabulary and pronunciation dictionary.  
4. Support importing recordings with explicit consent.  
5. Research local voice reconstruction and cloning.  
6. Allow the user to control, export and delete their voice data.

Do not train or clone anyone's voice without clear informed consent. Make consent revocable, and protect voice recordings as highly sensitive personal data.

## **6\. What I would build in the next 90 days**

The full vision is large. The mistake would be trying to build all six systems simultaneously.

I would divide the work into three releases.

Month 1 — Communication foundation

Highest priority

Make the existing product genuinely excellent.

* Stabilise current TTS, Piper and Android TTS switching.  
* Create the engine adapter architecture.  
* Build a proper two-way conversation interface.  
* Implement live speech-to-text with sherpa-onnx.  
* Add editable live captions and text-to-speech responses.  
* Improve AAC, phrase boards and communication profiles.  
* Build the offline model download and capability manager.  
* Polish the accessibility-first home screen.

Month 2 — Multilingual intelligence and hearing accessibility

Expand the communication capabilities.

* Integrate and benchmark IndicConformer.  
* Test IndicTrans2 and IndicXlit.  
* Evaluate Maya 2 Native and additional neural TTS engines.  
* Add language-specific voice and pronunciation testing.  
* Implement environmental sound alerts.  
* Add visual notifications and custom vibration patterns.  
* Test mixed-language communication.  
* Recruit native speakers and people with different communication needs for testing.

Month 3 — Accessibility ecosystem and public beta

Prepare for real-world usage.

* Implement switch-access and alternative input improvements.  
* Add an ISL resource library with community validation.  
* Prototype a limited sign-recognition workflow.  
* Improve low-end Android performance and battery consumption.  
* Add exportable, user-controlled personal vocabulary.  
* Complete privacy and security review.  
* Launch the website and public Android beta.  
* Test with real users, not just internal test accounts.

I would not promise production-quality speech in all 22 languages in 90 days. Instead, build the 22-language capability framework, and release languages only when their speech and accessibility quality is verified.

## **7\. The technology stack I would standardise**

| Layer | Recommended technology |
| ----- | ----- |
| Android application | Existing React Native \+ Expo |
| Native integrations | Kotlin |
| Application state | Zustand |
| Local database | SQLite |
| Speech inference | sherpa-onnx |
| ASR | IndicConformer, Whisper-family models |
| TTS | Android TTS, Piper, Kokoro, evaluated Indic TTS |
| Translation | IndicTrans2 |
| Transliteration | IndicXlit |
| Sound classification | YAMNet / LiteRT |
| Computer vision | MediaPipe |
| Sign research | ISLiM and future ISL models |
| Optional local LLM | Quantised small open-weight models |
| Website | Next.js / React |
| Testing | Jest, React Native Testing Library, Detox, native Android tests |
| Model distribution | Versioned downloadable model packages |
| Backend | None required for core operation |

Keep the existing SQLite database and Zustand state architecture. Add a model registry containing:

* Model ID and version.  
* Supported languages.  
* Supported tasks.  
* Download size.  
* Required RAM and storage.  
* Supported device architecture.  
* Model and code licences.  
* Offline capability.  
* Quality status.  
* Compatibility with the current application version.

The app should download only the models the user needs. Do not bundle every language model into the APK.

## **8\. What we should copy versus what we should own**

| Borrow / integrate | Build as SwarSathi's own IP |
| ----- | ----- |
| ASR and TTS research | Unified communication experience |
| Translation models | Personal communication profiles |
| Sound classification models | Accessibility-first sound alert UX |
| Pose and hand landmark models | User-controlled communication workflows |
| Open-source inference runtimes | Model routing and capability detection |
| AAC vocabulary research | Personalised AAC and phrase system |
| Existing accessibility patterns | Universal communication interface |

A crucial legal distinction: open-source code, open model weights and open datasets are not automatically interchangeable licences. Audit each repository, checkpoint, voice, dataset and dependency individually. Some model licences restrict redistribution or commercial use even when the code is open.

For SwarSathi, I would maintain a `THIRD_PARTY_LICENSES` register from day one.

## **9\. What must never become a dependency**

These should be architectural requirements, not marketing promises.

1. No mandatory paid API.  
2. No mandatory account or sign-in.  
3. No advertisements.  
4. No selling communication histories or voice recordings.  
5. No mandatory cloud processing.  
6. No subscription to access essential communication.  
7. No requirement for an expensive smartphone.  
8. No single-model dependency.  
9. No AI-generated communication sent without the user's approval.  
10. No false claims that AI can perfectly understand every language or sign.

We can offer optional self-hosted services later, but the core product must remain useful without them.

## **10\. My biggest strategic recommendation**

I would build SwarSathi around a concept called the Universal Communication Engine.

Not a collection of AI features. One engine that understands the user's preferred input and output methods and routes information between them.

# **Universal Communication Engine**

Input → Understand → Transform → Express

INPUT

Voice · Text · Sign · Symbols · Camera · Touch · Switch

UNDERSTAND

Speech · Language · Context · Visual recognition · User intent

TRANSFORM

Transcribe · Translate · Simplify · Convert · Personalise

OUTPUT

Speech · Text · Sign resources · Visuals · Haptics · Audio

DELIVERY

Face-to-face · Audio messages · Compatible apps · Sharing

Imagine this:

A person who cannot speak types something in Malayalam. SwarSathi can speak it aloud in their chosen voice. The other person replies in Hindi. SwarSathi transcribes it, translates it and displays it in Malayalam. A person who cannot hear can read the response. A person who cannot type can use a phrase board. A person who communicates through sign language can access sign-supported communication resources.

That's the direction.

The ultimate product is not a better artificial voice. It is freedom to communicate.

One final engineering point: the biggest measure of success should not be the number of models or languages integrated. It should be how many real communication situations a person can complete independently, privately and without paying.

My recommendation is to freeze the existing app's working foundation and make the Universal Communication Engine \+ two-way conversation mode the next architectural milestone. Everything else can plug into that foundation.

For the next step, I would turn this map into a repository-level engineering blueprint: exact modules, folder structure, interfaces, model choices, dependencies, integration order and test requirements—preserving the work already completed.

