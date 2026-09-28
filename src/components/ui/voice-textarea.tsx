import React, { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VoiceTextareaProps extends Omit<React.ComponentProps<'textarea'>, 'onChange'> {
  onValueChange?: (value: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export function VoiceTextarea({ className, onValueChange, onChange, value, ...props }: VoiceTextareaProps) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSupported(false);
        return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        
        if (finalTranscript) {
          const currentValue = value?.toString() || '';
          const separator = currentValue && !currentValue.endsWith(' ') && !currentValue.endsWith('\n') ? ' ' : '';
          
          if (onValueChange) {
            onValueChange(currentValue + separator + finalTranscript);
          } else if (onChange) {
            // Create a synthetic event
            const syntheticEvent = {
              target: { name: props.name, value: currentValue + separator + finalTranscript }
            } as React.ChangeEvent<HTMLTextAreaElement>;
            onChange(syntheticEvent);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech') {
          toast({
            variant: "destructive",
            title: "Microphone Error",
            description: `Error: ${event.error}. Please check your permissions.`
          });
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [onChange, onValueChange, value, toast, props.name]);

  const toggleListening = () => {
    if (!supported || !recognitionRef.current) {
      toast({
        title: "Not Supported",
        description: "Voice typing is not supported in this browser. Please use Chrome or Edge.",
        variant: "destructive"
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast({
          title: "Listening...",
          description: "Speak clearly into your microphone.",
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="relative">
      <Textarea
        className={`${className || ''} pr-10`}
        value={value}
        onChange={onChange ? onChange : (e) => onValueChange && onValueChange(e.target.value)}
        {...props}
      />
      {supported && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`absolute bottom-2 right-2 h-8 w-8 p-0 rounded-full ${isListening ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 animate-pulse' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={toggleListening}
          title="Voice Typing"
        >
          {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}
