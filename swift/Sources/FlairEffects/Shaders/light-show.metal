// flair-metal-hash: 4144c9ca
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    float3 uBackground;
    float3 uFlame;
    float3 uSparks;
    packed_float3 uBeam;
    int uJets;
    float uSpeed;
    float uBeams;
    float uBackgroundAlpha;
};

struct flair_light_show_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float fire(thread const float& x, thread const float& len)
{
    return smoothstep(0.0, 0.07999999821186065673828125, x) * (1.0 - smoothstep(len * 0.699999988079071044921875, len, x));
}

static inline __attribute__((always_inline))
float3 flameRamp(thread const float& t, constant FlairUniforms& _245)
{
    float3 c = mix(_245.uFlame * 0.300000011920928955078125, _245.uFlame, float3(smoothstep(0.0, 0.449999988079071044921875, t)));
    c = mix(c, float3(1.0, 0.85000002384185791015625, 0.449999988079071044921875), float3(smoothstep(0.449999988079071044921875, 0.800000011920928955078125, t)));
    return mix(c, float3(1.0, 0.9700000286102294921875, 0.87999999523162841796875), float3(smoothstep(0.800000011920928955078125, 1.0, t)));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _245)
{
    float2 uv = fragCoord / float2(_245.iResolution[0], _245.iResolution[1]);
    float aspect = _245.iResolution[0u] / _245.iResolution[1u];
    float2 p = float2((uv.x - 0.5) * aspect, uv.y);
    float t = _245.iTime * _245.uSpeed;
    float3 col = _245.uBackground * (0.60000002384185791015625 + (0.60000002384185791015625 * (1.0 - uv.y)));
    float2 param = (p * 3.0) + float2(t * 0.100000001490116119384765625, 0.0);
    int param_1 = 3;
    float _326 = fbm(param, param_1);
    float haze = 0.60000002384185791015625 + (0.60000002384185791015625 * _326);
    for (int i = 0; i < 4; i++)
    {
        float fi = float(i);
        float2 o = float2((((fi / 3.0) - 0.5) * aspect) * 0.89999997615814208984375, -0.0500000007450580596923828125);
        float aim = (0.550000011920928955078125 * sin((t * (0.3499999940395355224609375 + (0.100000001490116119384765625 * fi))) + (fi * 1.89999997615814208984375))) + ((fi < 1.5) ? 0.20000000298023223876953125 : (-0.20000000298023223876953125));
        float2 d = p - o;
        float ang = precise::atan2(d.x, d.y) - aim;
        float cone = exp(((-ang) * ang) / 0.0024999999441206455230712890625) * smoothstep(1.39999997615814208984375, 0.0, length(d));
        float3 tint = mix(float3(_245.uBeam), float3(1.0), float3(0.25 * mod(fi, 2.0)));
        col += ((((tint * cone) * haze) * 0.3499999940395355224609375) * _245.uBeams);
    }
    float phrase = floor(t / 4.0);
    float pattern = mod(phrase, 4.0);
    float local = mod(t, 4.0);
    float jets = float(_245.uJets);
    float stageGlow = 0.0;
    float f;
    float _524;
    for (int j = 0; j < 12; j++)
    {
        if (j >= _245.uJets)
        {
            break;
        }
        float fj = float(j);
        float x01 = (fj + 0.5) / jets;
        float x = ((x01 - 0.5) * aspect) * 0.89999997615814208984375;
        if (pattern < 0.5)
        {
            float param_2 = local;
            float param_3 = 1.39999997615814208984375;
            f = fire(param_2, param_3);
        }
        else
        {
            if (pattern < 1.5)
            {
                float param_4 = local - (x01 * 1.7999999523162841796875);
                float param_5 = 0.89999997615814208984375;
                f = fire(param_4, param_5);
            }
            else
            {
                if (pattern < 2.5)
                {
                    float param_6 = local - (abs(x01 - 0.5) * 2.599999904632568359375);
                    float param_7 = 1.0;
                    f = fire(param_6, param_7);
                }
                else
                {
                    float param_8 = mod(local + ((mod(fj, 2.0) < 0.5) ? 0.0 : 1.0), 2.0);
                    float param_9 = 0.800000011920928955078125;
                    f = fire(param_8, param_9);
                }
            }
        }
        if (pattern < 0.5)
        {
            _524 = smoothstep(1.39999997615814208984375, 1.7999999523162841796875, local) * (1.0 - smoothstep(3.599999904632568359375, 4.0, local));
        }
        else
        {
            _524 = float(pattern > 2.5);
        }
        float gerb = (1.0 - f) * _524;
        stageGlow += (f + (gerb * 0.300000011920928955078125));
        float2 q = p - float2(x, 0.0);
        if (abs(q.x) > 0.25)
        {
            continue;
        }
        if (f > 0.00999999977648258209228515625)
        {
            float H = 0.75 * f;
            float y = q.y / fast::max(H, 0.001000000047497451305389404296875);
            if (y < 1.2999999523162841796875)
            {
                float2 param_10 = float2((q.x * 10.0) + (fj * 7.0), (q.y * 5.0) - (t * 6.0));
                int param_11 = 4;
                float _599 = fbm(param_10, param_11);
                float turb = _599;
                float wdt = 0.01200000010430812835693359375 + (q.y * 0.12999999523162841796875);
                float dx = q.x + ((((turb - 0.5) * 0.119999997317790985107421875) * q.y) * 2.0);
                float core = exp(((-dx) * dx) / (wdt * wdt));
                float heat = ((core * (1.0 - smoothstep(0.20000000298023223876953125, 1.2000000476837158203125, y + ((turb - 0.5) * 0.5)))) * f) * 1.39999997615814208984375;
                float param_12 = heat;
                col += ((flameRamp(param_12, _245) * smoothstep(0.02999999932944774627685546875, 0.300000011920928955078125, heat)) * 1.60000002384185791015625);
            }
        }
        if (gerb > 0.00999999977648258209228515625)
        {
            float gx = q.x * 90.0;
            float top = 0.550000011920928955078125 + (0.100000001490116119384765625 * sin((t * 3.0) + fj));
            if (abs(gx) < 4.0)
            {
                float lane = floor(gx);
                float2 param_13 = float2(lane, fj);
                float speedY = 3.0 + (hash12(param_13) * 2.0);
                float2 param_14 = float2(fj, lane);
                float cy = ((q.y * 6.0) - (t * speedY)) + (hash12(param_14) * 10.0);
                float cell = floor(cy);
                float2 param_15 = float2(lane + (fj * 9.0), cell);
                float2 r = hash22(param_15);
                float lit = step(0.449999988079071044921875, r.x) * (1.0 - (abs(gx) / 4.0));
                float tailF = fract(cy);
                float spark = (lit * smoothstep(0.449999988079071044921875, 0.949999988079071044921875, tailF)) * (1.0 - smoothstep(0.949999988079071044921875, 1.0, tailF));
                float across = exp(-powr(((fract(gx) - 0.5) - ((r.y - 0.5) * 0.60000002384185791015625)) * 5.0, 2.0));
                col += (((((mix(_245.uSparks, float3(1.0), float3(0.300000011920928955078125)) * spark) * across) * gerb) * (1.0 - smoothstep(top * 0.4000000059604644775390625, top, q.y))) * 1.39999997615814208984375);
            }
            col += ((((_245.uSparks * exp((-abs(q.x)) * 60.0)) * (1.0 - smoothstep(0.0, top, q.y))) * gerb) * 0.119999997317790985107421875);
            col += ((_245.uSparks * exp((-length(q * float2(1.0, 2.0))) * 40.0)) * gerb);
        }
    }
    col += ((((_245.uFlame * stageGlow) / float3(jets)) * 0.60000002384185791015625) * exp((-p.y) * 6.0));
    col = float3(1.0) - exp((-fast::max(col, float3(0.0))) * 1.2000000476837158203125);
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _884;
    if (a > 0.0)
    {
        _884 = bg + (d / float3(a));
    }
    else
    {
        _884 = bg;
    }
    float3 fg = _884;
    float alpha = a + (opacity * (1.0 - a));
    float3 _906;
    if (alpha > 0.0)
    {
        _906 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _906 = bg;
    }
    float3 col = _906;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _245)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _245);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _245.uBackground;
    float param_4 = _245.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_light_show_frag_out flair_light_show_frag(constant FlairUniforms& _245 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_light_show_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _964;
    if (_245.flair_flipY > 0.5)
    {
        _964 = _245.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _964 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _964);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _245);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

