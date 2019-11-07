# import microphone_stream
import dialogflow_v2 as dialogflow
import pyaudio
import re
import os

PROJECT_ID = os.environ["PROJECT_ID"]
# Audio recording parameters
STREAMING_LIMIT = 10000
SAMPLE_RATE = 16000
CHUNK_SIZE = int(SAMPLE_RATE / 10)  # 100ms
OUTPUT_BUFFER = 1000


def grab_intent():
    """Start stream from microphone input to dialogflow API"""
   
    session_client = dialogflow.SessionsClient()
    # Audio output stream
    
    final_request_received = False

    def __play_audio(audio):
        output_stream = pyaudio.PyAudio().open(channels=1,
            rate=SAMPLE_RATE, format=pyaudio.paInt16, output=True)
        output_stream.write(audio)
        output_stream.close()

    def __request_generator():
        input_stream = pyaudio.PyAudio().open(channels=1,
                rate=SAMPLE_RATE, format=pyaudio.paInt16, input=True)
        audio_encoding = dialogflow.enums.AudioEncoding.AUDIO_ENCODING_LINEAR_16
        language_code = "en"
        session_id = 1 # not sure what this should be
        session_path = session_client.session_path(PROJECT_ID, session_id)
        print('Session path: {}\n'.format(session_path))
        
        input_audio_config = dialogflow.types.InputAudioConfig(audio_encoding=audio_encoding, 
            language_code=language_code,
            sample_rate_hertz=SAMPLE_RATE)
        speech_config = dialogflow.types.SynthesizeSpeechConfig(
            voice=dialogflow.types.VoiceSelectionParams(ssml_gender=dialogflow.enums.SsmlVoiceGender.SSML_VOICE_GENDER_FEMALE))
            #name="en-GB-Standard-A"))
        output_audio_config = dialogflow.types.OutputAudioConfig(
            audio_encoding=dialogflow.enums.OutputAudioEncoding.OUTPUT_AUDIO_ENCODING_LINEAR_16,
            sample_rate_hertz=SAMPLE_RATE,
            synthesize_speech_config=speech_config)
        query_input = dialogflow.types.QueryInput(audio_config=input_audio_config)

        # The first request contains the configuration.
        yield dialogflow.types.StreamingDetectIntentRequest(
            session=session_path, query_input=query_input, output_audio_config=output_audio_config)

        while True:
            if final_request_received:
                print("received final request")
                input_stream.close()
                print("closed stream")
                return
            if input_stream.is_active():
                content = input_stream.read(CHUNK_SIZE,exception_on_overflow = False)
                yield dialogflow.types.StreamingDetectIntentRequest(input_audio=content)
        print("Exiting generator")
        



    while True:
        print('=' * 20)
        requests = __request_generator()
        responses = session_client.streaming_detect_intent(requests)

        for response in responses:
            print(f'Intermediate transcription result: {response.recognition_result.transcript}')
            if response.recognition_result.is_final:
                final_request_received = True
                if re.search(r'\b(exit|quit)\b', response.recognition_result.transcript, re.I):
                    print("Wants exit")
                    return True
            if response.query_result.query_text:
                print(f'Hal: {response.query_result.fulfillment_text}')
                print(f'Hal Intent: {response.query_result}.intent')
            if response.output_audio:
                __play_audio(response.output_audio)
                final_request_received = False
    return False

def main():
    wants_exit = False
    while not wants_exit:
        wants_exit = grab_intent()
    print("Goodbye")
if __name__ == "__main__":
    main()