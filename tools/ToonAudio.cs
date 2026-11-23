// Lululingo – lyd til tegnefilm: blander stemmer med lille baggrundsmusik og lydeffekter.
// Bruges af tools/generate-episode.ps1 (indlæses med Add-Type). Kun C# 5, så det virker i Windows PowerShell 5.1.
using System;
using System.Collections.Generic;
using System.Text;

public static class ToonAudio
{
    const double TAU = Math.PI * 2;

    public static float[] PcmToFloat(byte[] pcm)
    {
        var f = new float[pcm.Length / 2];
        for (int i = 0; i < f.Length; i++) f[i] = (short)(pcm[2 * i] | (pcm[2 * i + 1] << 8)) / 32768f;
        return f;
    }

    public static void AddPcm(float[] buf, byte[] pcm, double t, int rate, float gain)
    {
        var f = PcmToFloat(pcm);
        int s0 = (int)Math.Round(t * rate);
        for (int i = 0; i < f.Length && s0 + i < buf.Length; i++) buf[s0 + i] += f[i] * gain;
    }

    public static byte[] FloatToPcm(float[] f)
    {
        var b = new byte[f.Length * 2];
        for (int i = 0; i < f.Length; i++)
        {
            double v = f[i];
            if (v > 0.95) v = 0.95 + (v - 0.95) * 0.2; // blød begrænsning
            if (v < -0.95) v = -0.95 + (v + 0.95) * 0.2;
            int s = (int)Math.Round(Math.Max(-1, Math.Min(1, v)) * 32767);
            b[2 * i] = (byte)(s & 0xff); b[2 * i + 1] = (byte)((s >> 8) & 0xff);
        }
        return b;
    }

    // Mundbevægelse: lydstyrke pr. 50 ms som cifre 0-9
    public static string Mouth(byte[] pcm, int rate)
    {
        var f = PcmToFloat(pcm);
        int win = rate / 20;
        var vals = new List<double>();
        double max = 1e-6;
        for (int i = 0; i < f.Length; i += win)
        {
            double s = 0; int n = 0;
            for (int j = i; j < Math.Min(f.Length, i + win); j++) { s += f[j] * f[j]; n++; }
            double r = Math.Sqrt(s / Math.Max(1, n));
            vals.Add(r); if (r > max) max = r;
        }
        var sb = new StringBuilder();
        foreach (var r in vals)
        {
            double v = r / max;
            int d = v < 0.08 ? 0 : (int)Math.Round(Math.Min(9, 1 + Math.Pow(v, 0.7) * 8.5));
            sb.Append((char)('0' + d));
        }
        return sb.ToString();
    }

    static double Midi(double n) { return 440.0 * Math.Pow(2, (n - 69) / 12.0); }

    // Klokke-lyd (sinus + overtoner med hurtig dæmpning)
    static void Bell(float[] buf, int rate, double t, double freq, double amp, double decay)
    {
        int s0 = (int)(t * rate); int len = (int)(rate * Math.Min(2.5, 5.0 / decay));
        for (int i = 0; i < len && s0 + i < buf.Length; i++)
        {
            if (s0 + i < 0) continue;
            double x = (double)i / rate;
            double env = Math.Exp(-x * decay) * Math.Min(1, x * 400);
            double v = Math.Sin(TAU * freq * x) + 0.35 * Math.Sin(TAU * freq * 2 * x) * Math.Exp(-x * decay) + 0.12 * Math.Sin(TAU * freq * 3.01 * x) * Math.Exp(-x * decay * 2);
            buf[s0 + i] += (float)(v * env * amp);
        }
    }

    // Blød bas (trekantbølge)
    static void Pluck(float[] buf, int rate, double t, double freq, double amp, double len)
    {
        int s0 = (int)(t * rate); int n = (int)(rate * len);
        for (int i = 0; i < n && s0 + i < buf.Length; i++)
        {
            if (s0 + i < 0) continue;
            double x = (double)i / rate;
            double ph = (freq * x) % 1.0;
            double tri = 4 * Math.Abs(ph - 0.5) - 1;
            double env = Math.Exp(-x * 3.2) * Math.Min(1, x * 200) * Math.Min(1, (len - x) * 30);
            buf[s0 + i] += (float)(tri * env * amp);
        }
    }

    // Blød akkord-flade
    static void Pad(float[] buf, int rate, double t, double len, double[] freqs, double amp)
    {
        int s0 = (int)(t * rate); int n = (int)(rate * len);
        for (int i = 0; i < n && s0 + i < buf.Length; i++)
        {
            if (s0 + i < 0) continue;
            double x = (double)i / rate;
            double env = Math.Min(1, x / 0.35) * Math.Min(1, (len - x) / 0.35);
            double v = 0;
            foreach (var f in freqs) v += Math.Sin(TAU * f * x + Math.Sin(TAU * 4.5 * x) * 0.15);
            buf[s0 + i] += (float)(v / freqs.Length * env * amp);
        }
    }

    static void Noise(float[] buf, int rate, double t, double len, double amp, double lp, double attack, double decay, Random rnd)
    {
        int s0 = (int)(t * rate); int n = (int)(rate * len); double y = 0;
        for (int i = 0; i < n && s0 + i < buf.Length; i++)
        {
            if (s0 + i < 0) continue;
            double x = (double)i / rate;
            double w = rnd.NextDouble() * 2 - 1;
            y += lp * (w - y);
            double env = Math.Min(1, x / attack) * Math.Exp(-x * decay);
            buf[s0 + i] += (float)(y * env * amp);
        }
    }

    static void Sweep(float[] buf, int rate, double t, double len, double f0, double f1, double amp, double vib)
    {
        int s0 = (int)(t * rate); int n = (int)(rate * len); double ph = 0;
        for (int i = 0; i < n && s0 + i < buf.Length; i++)
        {
            if (s0 + i < 0) continue;
            double x = (double)i / rate; double k = x / len;
            double f = f0 * Math.Pow(f1 / f0, k) * (1 + Math.Sin(TAU * 14 * x) * vib);
            ph += TAU * f / rate;
            double env = Math.Min(1, x * 150) * Math.Min(1, (len - x) * 40);
            buf[s0 + i] += (float)(Math.Sin(ph) * env * amp);
        }
    }

    public static void Sfx(float[] buf, int rate, string name, double t)
    {
        var rnd = new Random(name.GetHashCode() ^ (int)(t * 1000));
        switch (name)
        {
            case "pop": Sweep(buf, rate, t, 0.12, 900, 300, 0.35, 0); break;
            case "boing": Sweep(buf, rate, t, 0.45, 180, 520, 0.3, 0.25); break;
            case "ding": Bell(buf, rate, t, 1320, 0.28, 4); break;
            case "coin": for (int i = 0; i < 3; i++) { Bell(buf, rate, t + i * 0.5, 1975, 0.16, 7); Bell(buf, rate, t + i * 0.5 + 0.07, 2637, 0.16, 7); } break;
            case "chime": { double[] n = { 72, 76, 79, 84 }; for (int i = 0; i < n.Length; i++) Bell(buf, rate, t + i * 0.12, Midi(n[i]), 0.2, 3.5); } break;
            case "tada": { double[] n = { 67, 72, 76, 79 }; for (int i = 0; i < n.Length; i++) Bell(buf, rate, t + i * 0.09, Midi(n[i]), 0.2, 2.6); Bell(buf, rate, t + 0.4, Midi(84), 0.25, 1.8); } break;
            case "sparkle": for (int i = 0; i < 7; i++) Bell(buf, rate, t + i * 0.09, Midi(84 + rnd.Next(0, 12)), 0.12, 6); break;
            case "bell": for (int i = 0; i < 6; i++) Bell(buf, rate, t + i * 0.06, Midi(i % 2 == 0 ? 88 : 91), 0.13, 5); break;
            case "knock": for (int i = 0; i < 2; i++) { Sweep(buf, rate, t + i * 0.22, 0.09, 160, 90, 0.55, 0); Noise(buf, rate, t + i * 0.22, 0.06, 0.25, 0.25, 0.002, 60, rnd); } break;
            case "whoosh": Noise(buf, rate, t, 0.55, 0.45, 0.12, 0.25, 4, rnd); break;
            case "blow": Noise(buf, rate, t, 0.8, 0.35, 0.08, 0.15, 2.5, rnd); break;
            case "grumble": Sweep(buf, rate, t, 0.9, 95, 60, 0.45, 0.35); break;
            case "munch": for (int i = 0; i < 4; i++) Noise(buf, rate, t + i * 0.28, 0.12, 0.4, 0.35, 0.005, 25, rnd); break;
            case "scribble": for (int i = 0; i < 9; i++) Noise(buf, rate, t + i * 0.13, 0.1, 0.18, 0.7, 0.01, 18, rnd); break;
            case "whisk": for (int i = 0; i < 10; i++) Noise(buf, rate, t + i * 0.2, 0.12, 0.2, 0.5, 0.01, 16, rnd); break;
            case "clap": for (int i = 0; i < 8; i++) Noise(buf, rate, t + i * 0.16 + rnd.NextDouble() * 0.03, 0.08, 0.45, 0.6, 0.002, 40, rnd); break;
            case "splash": Noise(buf, rate, t, 0.7, 0.5, 0.3, 0.005, 6, rnd); Sweep(buf, rate, t, 0.15, 600, 1400, 0.12, 0); break;
            case "tweet": for (int i = 0; i < 3; i++) Sweep(buf, rate, t + i * 0.16, 0.1, 2600, 4200, 0.1, 0.05); break;
            case "door": Sweep(buf, rate, t, 0.2, 120, 70, 0.4, 0); break;
            case "jump": Sweep(buf, rate, t, 0.22, 300, 900, 0.22, 0); break;
        }
    }

    // Lille procedural baggrundsmusik. Dæmpes mens nogen taler.
    public static void Music(float[] buf, int rate, string style, double t0, double t1, double[] speechStart, double[] speechEnd, int seed)
    {
        if (style == "none" || t1 - t0 < 0.5) return;
        double bpm = 110; int key = 60; int[] prog = { 0, 9, 5, 7 }; bool hats = false, rain = false, quiet = false;
        if (style == "calm") { bpm = 86; key = 65; prog = new int[] { 0, 5, 9, 7 }; }
        if (style == "rain") { bpm = 72; key = 60; prog = new int[] { 9, 5, 0, 7 }; rain = true; }
        if (style == "party") { bpm = 126; key = 67; prog = new int[] { 0, 7, 9, 5 }; hats = true; }
        if (style == "quiet") { bpm = 92; key = 62; prog = new int[] { 9, 5, 9, 7 }; quiet = true; }
        var rnd = new Random(seed);
        var m = new float[buf.Length];
        double beat = 60.0 / bpm, bar = beat * 4;
        int[] penta = { 0, 2, 4, 7, 9 };
        // To små melodistykker (A og B), spillet A A B A
        var phrases = new List<int[]>();
        for (int p = 0; p < 2; p++)
        {
            var ph = new int[16]; int cur = rnd.Next(0, 5);
            for (int i = 0; i < 16; i++)
            {
                if (rnd.NextDouble() < (i % 4 == 0 ? 0.08 : 0.38)) { ph[i] = -1; continue; }
                cur = Math.Max(0, Math.Min(9, cur + rnd.Next(-2, 3)));
                ph[i] = cur;
            }
            phrases.Add(ph);
        }
        int[] form = { 0, 0, 1, 0 };
        int barN = 0;
        for (double bt = t0; bt < t1; bt += bar, barN++)
        {
            int root = prog[barN % 4];
            bool minor = root == 9 || root == 2 || root == 4;
            double[] chord = { Midi(key + root), Midi(key + root + (minor ? 3 : 4)), Midi(key + root + 7) };
            if (!quiet) Pad(m, rate, bt, Math.Min(bar, t1 - bt), chord, rain ? 0.09 : 0.07);
            for (int b = 0; b < 4; b++)
            {
                double tb = bt + b * beat; if (tb >= t1) break;
                if (b % 2 == 0 || hats) Pluck(m, rate, tb, Midi(key + root - 24 + (b == 2 ? 7 : 0)), quiet ? 0.12 : 0.16, beat * 0.9);
                if (hats) { Noise(m, rate, tb + beat / 2, 0.05, 0.05, 0.9, 0.002, 60, rnd); }
            }
            var phrase = phrases[form[(barN / 2) % 4]];
            int half = barN % 2;
            for (int i = 0; i < 8; i++)
            {
                int n = phrase[half * 8 + i]; if (n < 0) continue;
                double tn = bt + i * beat / 2; if (tn >= t1) break;
                if (quiet && i % 2 == 1) continue;
                int deg = penta[n % 5] + 12 * (n / 5);
                Bell(m, rate, tn, Midi(key + 12 + deg), rain ? 0.07 : 0.085, rain ? 3 : 4.5);
            }
        }
        if (rain) Noise(m, rate, t0, t1 - t0, 0.05, 0.05, 1.0, 0, rnd);
        // ind- og udtoning, og dæmpning under tale
        int a = (int)(t0 * rate), z = Math.Min(buf.Length, (int)(t1 * rate));
        double duck = 1; int si = 0;
        double dk = 1.0 / (rate * 0.12);
        for (int i = Math.Max(0, a); i < z; i++)
        {
            double x = (double)i / rate;
            while (si < speechEnd.Length && speechEnd[si] + 0.1 < x) si++;
            bool talking = si < speechStart.Length && x >= speechStart[si] - 0.12 && x <= speechEnd[si] + 0.1;
            double target = talking ? 0.4 : 1.0;
            duck += (target - duck) * dk * 6;
            double fade = Math.Min(1, (x - t0) / 0.8) * Math.Min(1, (t1 - x) / 0.8);
            buf[i] += (float)(m[i] * fade * duck * 0.9);
        }
    }
}
