// flair-metal-hash: f653e72e
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float3 uColor;
    packed_float3 uHighlight;
    float uGloss;
    float uDrip;
    float uSize;
    char _m18_pad[8];
    packed_float3 uBackground;
    float uBackgroundAlpha;
    uint uAnimate;
    float uProgress;
};

struct flair_melting_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float meltCycle(thread const float& rate, constant FlairUniforms& _235)
{
    float u = fract(_235.iTime / 8.0);
    float m = fast::clamp((fast::min(u, 0.62000000476837158203125) * 2.0) * rate, 0.0, 1.0);
    m = (m * m) * (3.0 - (2.0 * m));
    return m * (1.0 - smoothstep(0.7400000095367431640625, 0.9700000286102294921875, u));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float letters(thread const float2& p, thread float& textH, thread float& textW, texture2d<float> uText, sampler uTextSmplr)
{
    float2 uv = ((p - float2(0.0, 0.14000000059604644775390625)) / float2(textW, textH)) + float2(0.5);
    bool _304 = uv.x < 0.0;
    bool _311;
    if (!_304)
    {
        _311 = uv.x > 1.0;
    }
    else
    {
        _311 = _304;
    }
    bool _318;
    if (!_311)
    {
        _318 = uv.y < 0.0;
    }
    else
    {
        _318 = _311;
    }
    bool _325;
    if (!_318)
    {
        _325 = uv.y > 1.0;
    }
    else
    {
        _325 = _318;
    }
    if (_325)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, uv).w;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float smin(thread const float& a, thread const float& b, thread float& k)
{
    k = fast::max(k, 9.9999997473787516355514526367188e-05);
    float h = fast::clamp(0.5 + ((0.5 * (b - a)) / k), 0.0, 1.0);
    return mix(b, a, h) - ((k * h) * (1.0 - h));
}

static inline __attribute__((always_inline))
float liquid(thread const float2& p, thread const float& m, thread float& textH, thread float& textW, constant FlairUniforms& _235, texture2d<float> uText, sampler uTextSmplr)
{
    float top = 0.14000000059604644775390625 + (0.2899999916553497314453125 * textH);
    float baseline = 0.14000000059604644775390625 - (0.23999999463558197021484375 * textH);
    float2 param = float2(p.x * 4.0, 1.0);
    int param_1 = 3;
    float _362 = fbm(param, param_1);
    float stretch = 1.0 + (m * (0.25 + (0.3499999940395355224609375 * _362)));
    float2 s = float2(p.x + ((m * 0.008000000379979610443115234375) * sin(p.y * 30.0)), top - ((top - p.y) / stretch));
    float r = 0.0030000000260770320892333984375 + (0.006000000052154064178466796875 * m);
    float2 param_2 = s;
    float cover = letters(param_2, textH, textW, uText, uTextSmplr) * 2.0;
    for (int i = 0; i < 4; i++)
    {
        float a = (float(i) * 1.57079994678497314453125) + 0.785000026226043701171875;
        float2 param_3 = s + (float2(cos(a), sin(a)) * r);
        cover += letters(param_3, textH, textW, uText, uTextSmplr);
    }
    cover /= 6.0;
    float d = (0.5 - cover) * 0.0199999995529651641845703125;
    float grow = smoothstep(0.0, 0.25, m);
    float cell = 0.12999999523162841796875 * textH;
    float c = floor(p.x / cell);
    for (int k = -1; k <= 1; k++)
    {
        float ci = c + float(k);
        float2 param_4 = float2(ci, 11.30000019073486328125);
        float2 h = hash22(param_4);
        float xi = ((ci + 0.25) + (0.5 * h.x)) * cell;
        float2 param_5 = float2(xi * 4.0, 1.0);
        int param_6 = 3;
        float _488 = fbm(param_5, param_6);
        float colStretch = 1.0 + (m * (0.25 + (0.3499999940395355224609375 * _488)));
        float root = top - ((top - baseline) * colStretch);
        float2 param_7 = float2(xi, baseline + (0.039999999105930328369140625 * textH));
        float2 param_8 = float2(ci, 2.7000000476837158203125);
        float on = step(0.5, letters(param_7, textH, textW, uText, uTextSmplr)) * step(0.25, hash12(param_8));
        if (on < 0.5)
        {
            continue;
        }
        float w = (textH * (0.02999999932944774627685546875 + (0.02500000037252902984619140625 * h.y))) * grow;
        float2 param_9 = float2(ci, 5.900000095367431640625);
        float len = (_235.uDrip * powr(m, 1.2999999523162841796875)) * (0.0599999986588954925537109375 + (0.300000011920928955078125 * hash12(param_9)));
        float head = root - len;
        float along = fast::clamp(p.y, head, root + (0.0599999986588954925537109375 * textH));
        float rr = w * mix(1.0, 0.60000002384185791015625, smoothstep(root, root - 0.07999999821186065673828125, p.y));
        rr = mix(rr, w * 1.25, smoothstep(head + (2.5 * w), head, p.y));
        float param_10 = d;
        float param_11 = length(float2(p.x - xi, p.y - along)) - rr;
        float param_12 = 0.00999999977648258209228515625 * grow;
        float _609 = smin(param_10, param_11, param_12);
        d = _609;
        float phase = fract((_235.iTime * 0.5) + h.y);
        float fall = (phase * phase) * 1.39999997615814208984375;
        float2 param_13 = float2(ci, 8.1000003814697265625);
        float drop = ((w * 1.10000002384185791015625) * smoothstep(0.3499999940395355224609375, 0.64999997615814208984375, m)) * step(0.5, hash12(param_13));
        d = fast::min(d, length(float2(p.x - xi, p.y - ((head - (w * 1.7999999523162841796875)) - fall))) - (drop * (1.0 - (0.300000011920928955078125 * phase))));
    }
    return d;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, thread float& textH, thread float& textW, constant FlairUniforms& _235, texture2d<float> uText, sampler uTextSmplr)
{
    float2 p = (fragCoord - (float2(_235.iResolution[0], _235.iResolution[1]) * 0.5)) / float2(_235.iResolution[1u]);
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float frame = _235.iResolution[0u] / _235.iResolution[1u];
    textH = fast::min(_235.uSize * 0.60000002384185791015625, (frame * _235.uSize) / aspect);
    textW = textH * aspect;
    float _719;
    if (_235.uAnimate != 0u)
    {
        float param = 1.0;
        _719 = meltCycle(param, _235);
    }
    else
    {
        _719 = _235.uProgress;
    }
    float m = _719;
    float px = 1.0 / _235.iResolution[1u];
    float2 param_1 = p;
    float param_2 = m;
    float d = liquid(param_1, param_2, textH, textW, _235, uText, uTextSmplr);
    float cover = smoothstep(px, -px, d);
    float4 col = float4(_235.uBackground[0], _235.uBackground[1], _235.uBackground[2], _235.uBackgroundAlpha);
    if (d < (2.0 * px))
    {
        float eps = 0.00150000001303851604461669921875;
        float2 param_3 = p + float2(eps, 0.0);
        float param_4 = m;
        float2 param_5 = p + float2(0.0, eps);
        float param_6 = m;
        float2 g = float2(liquid(param_3, param_4, textH, textW, _235, uText, uTextSmplr) - d, liquid(param_5, param_6, textH, textW, _235, uText, uTextSmplr) - d);
        g /= float2(fast::max(length(g), 9.9999997473787516355514526367188e-06));
        float thick = sqrt(fast::clamp((-d) / 0.01200000010430812835693359375, 0.0, 1.0));
        float3 n = fast::normalize(float3((g * (1.0 - thick)) * 1.7999999523162841796875, 0.3499999940395355224609375 + thick));
        float3 l = float3(-0.4256282746791839599609375, 0.59587955474853515625, 0.6810052394866943359375);
        float diff = fast::clamp(dot(n, l), 0.0, 1.0);
        float spec = powr(fast::max(dot(reflect(-l, n), float3(0.0, 0.0, 1.0)), 0.0), 40.0);
        float3 body = mix((_235.uColor * _235.uColor) * 0.800000011920928955078125, _235.uColor, float3(thick)) * (0.5 + (0.64999997615814208984375 * diff));
        body += (float3(_235.uHighlight) * ((spec * _235.uGloss) + ((powr(1.0 - n.z, 3.0) * 0.1500000059604644775390625) * _235.uGloss)));
        col = mix(col, float4(body, 1.0), float4(cover));
    }
    fragColor = float4(col.xyz, col.w);
}

fragment flair_melting_text_frag_out flair_melting_text_frag(constant FlairUniforms& _235 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_melting_text_frag_out out = {};
    float textH = 0.300000011920928955078125;
    float textW = 1.0;
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _899;
    if (_235.flair_flipY > 0.5)
    {
        _899 = _235.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _899 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _899);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, textH, textW, _235, uText, uTextSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

