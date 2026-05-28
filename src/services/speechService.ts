class SpeechService {
  private lastSpokenTime: Map<string, number> = new Map();
  private globalLastSpokenTime: number = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private enabled: boolean = true;

  private cleanText(text: string): string {
    return text
      .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '') // strip standard emojis
      .replace(/[❌⚠️🔄👇⚡↩️✅🟢]/g, '') // strip custom training/form check emojis
      .replace(/\s+/g, ' ')
      .trim();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  cancel() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
  }

  speak(text: string, priority: 'high' | 'medium' | 'low' = 'low', cooldownMs: number = 5000) {
    if (!this.enabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const cleaned = this.cleanText(text);
    if (!cleaned || cleaned.toLowerCase().includes('establishing') || cleaned.toLowerCase().includes('scanning')) {
      return;
    }

    const now = Date.now();

    // 1. Check duplicate cooldown for this specific prompt
    const lastTime = this.lastSpokenTime.get(cleaned) || 0;
    if (now - lastTime < cooldownMs) {
      return; // Skip repeated prompts within their cooldown window
    }

    // 2. Check global inter-phrase delay to prevent overlapping/cluttered speech
    const timeSinceLastSpeech = now - this.globalLastSpokenTime;
    if (priority !== 'high' && timeSinceLastSpeech < 1500) {
      return; // Skip if another phrase was spoken too recently
    }

    // 3. For high-priority prompts, interrupt any active speech
    if (priority === 'high') {
      window.speechSynthesis.cancel();
    } else if (window.speechSynthesis.speaking) {
      return; // If already speaking, ignore non-high priority prompts
    }

    const utterance = new SpeechSynthesisUtterance(cleaned);
    
    // Set speech rate for a natural trainer voice (slightly faster/firm)
    utterance.rate = priority === 'high' ? 1.15 : 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.globalLastSpokenTime = Date.now();
      this.lastSpokenTime.set(cleaned, this.globalLastSpokenTime);
    };

    utterance.onend = () => {
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
      }
    };

    utterance.onerror = () => {
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
      }
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }
}

export const speechService = new SpeechService();
