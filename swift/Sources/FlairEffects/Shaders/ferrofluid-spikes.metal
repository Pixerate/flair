// flair-metal-hash: c85e75df
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

// Implementation of signed integer mod accurate to SPIR-V specification
template<typename Tx, typename Ty>
inline Tx spvSMod(Tx x, Ty y)
{
    Tx remainder = x - y * (x / y);
    return select(Tx(remainder + y), remainder, remainder == 0 || (x >= 0) == (y >= 0));
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
    float uGain;
    float uPulse;
    float uSway;
    float uSpacing;
    float3 uLightA;
    float3 uLightB;
    float3 uDish;
    packed_float3 uBackground;
    uint uDemo;
    float uBackgroundAlpha;
};

struct flair_ferrofluid_spikes_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _78)
{
    bool _84 = _78.uDemo != 0u;
    bool _93;
    if (_84)
    {
        _93 = _78.iBeat == 0.0;
    }
    else
    {
        _93 = _84;
    }
    bool _104;
    if (_93)
    {
        _104 = dot(_78.iAudio, _78.iAudio) == 0.0;
    }
    else
    {
        _104 = _93;
    }
    return _104;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _78)
{
    return exp((-mod(_78.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _78)
{
    return exp((-mod(_78.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _78)
{
    if (!soundDemo(_78))
    {
        return _78.iAudio;
    }
    float k = demoKick(_78);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_78.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_78.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_78))) + (0.07999999821186065673828125 * sin(_78.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _78)
{
    float _184;
    if (soundDemo(_78))
    {
        _184 = mod(_78.iTime, 0.5);
    }
    else
    {
        _184 = _78.iBeat;
    }
    return _184;
}

static inline __attribute__((always_inline))
float4 hexCell(thread const float2& p)
{
    float4 c = floor(float4(p, p - float2(0.5, 1.0)) / float4(1.0, 1.73205077648162841796875, 1.0, 1.73205077648162841796875)) + float4(0.5);
    float4 h = float4(p - (c.xy * float2(1.0, 1.73205077648162841796875)), p - ((c.zw + float2(0.5)) * float2(1.0, 1.73205077648162841796875)));
    float4 _366;
    if (dot(h.xy, h.xy) < dot(h.zw, h.zw))
    {
        _366 = float4(h.xy, c.xy * float2(1.0, 1.73205077648162841796875));
    }
    else
    {
        _366 = float4(h.zw, (c.zw + float2(0.5)) * float2(1.0, 1.73205077648162841796875));
    }
    return _366;
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _78)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_78))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_78.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_78.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_78.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_78)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_78)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_78.iSpectrum[i / 4][spvSMod(i, 4)], _78.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float smin(thread const float& a, thread const float& b, thread const float& k)
{
    float h = fast::clamp(0.5 + ((0.5 * (b - a)) / k), 0.0, 1.0);
    return mix(b, a, h) - ((k * h) * (1.0 - h));
}

static inline __attribute__((always_inline))
float fluid(thread const float3& p, constant FlairUniforms& _78, thread float& gHit, thread float& gTreble)
{
    float pool = (length(p / float3(1.0, 0.0900000035762786865234375, 1.0)) - 1.0) * 0.0900000035762786865234375;
    float2 param = p.xz / float2(_78.uSpacing);
    float4 h = hexCell(param);
    float2 centre = h.zw * _78.uSpacing;
    float rc = length(centre);
    if (rc > 0.89999997615814208984375)
    {
        return pool;
    }
    float param_1 = rc / 0.89999997615814208984375;
    float _437 = spectrum(param_1, _78);
    float tall = ((((1.0 - (rc * rc)) * (0.0599999986588954925537109375 + ((0.449999988079071044921875 * _437) * _78.uGain))) * (1.0 + ((0.60000002384185791015625 * gHit) * _78.uPulse))) * _78.uSpacing) / 0.10999999940395355224609375;
    tall = fast::max(tall, 0.00999999977648258209228515625);
    float y = fast::clamp(p.y / tall, 0.0, 1.0);
    float2 local = (h.xy * _78.uSpacing) - (((((float2(sin((_78.iTime * 9.0) + (centre.x * 23.0)), cos((_78.iTime * 7.0) + (centre.y * 19.0))) * 0.01200000010430812835693359375) * _78.uSway) * gTreble) * y) * y);
    float spike = (length(local) - ((_78.uSpacing * 0.4600000083446502685546875) * powr(1.0 - y, 1.60000002384185791015625))) * 0.60000002384185791015625;
    float param_2 = pool;
    float param_3 = fast::max(spike, p.y - tall);
    float param_4 = 0.0350000001490116119384765625;
    return smin(param_2, param_3, param_4);
}

static inline __attribute__((always_inline))
float scene(thread const float3& p, constant FlairUniforms& _78, thread float& gHit, thread float& gTreble)
{
    float3 param = p;
    return fast::min(fluid(param, _78, gHit, gTreble), p.y);
}

static inline __attribute__((always_inline))
float3 studio(thread const float3& d, constant FlairUniforms& _78)
{
    float3 c = float3(_78.uBackground) + (float3(0.02999999932944774627685546875) * ((d.y * 0.5) + 0.5));
    c += ((float3(2.5) * smoothstep(0.449999988079071044921875, 0.75, d.y)) * smoothstep(0.800000011920928955078125, 0.4000000059604644775390625, abs(d.x)));
    float az = precise::atan2(d.x, d.z);
    float band = smoothstep(-0.100000001490116119384765625, 0.1500000059604644775390625, d.y) * smoothstep(0.85000002384185791015625, 0.550000011920928955078125, d.y);
    c += (((_78.uLightA * 2.599999904632568359375) * smoothstep(0.3499999940395355224609375, 0.119999997317790985107421875, abs(az - 1.2000000476837158203125))) * band);
    c += (((_78.uLightB * 2.599999904632568359375) * smoothstep(0.3499999940395355224609375, 0.119999997317790985107421875, abs(az + 1.2000000476837158203125))) * band);
    c += ((float3(1.2000000476837158203125) * smoothstep(0.300000011920928955078125, 0.100000001490116119384765625, abs(abs(az) - 2.900000095367431640625))) * band);
    c += ((float3(0.3499999940395355224609375) * smoothstep(0.0, 0.119999997317790985107421875, d.y)) * smoothstep(0.4000000059604644775390625, 0.1500000059604644775390625, d.y));
    return c;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _78, thread float& gHit, thread float& gTreble)
{
    float2 p = (fragCoord - (float2(_78.iResolution[0], _78.iResolution[1]) * 0.5)) / float2(_78.iResolution[1u]);
    float4 s = sound(_78);
    float b = beat(_78);
    float _662;
    if (b >= 0.0)
    {
        _662 = exp((-b) * 6.0);
    }
    else
    {
        _662 = 0.0;
    }
    gHit = _662;
    gTreble = s.w;
    float orbit = _78.iTime * 0.0599999986588954925537109375;
    float3 ro = float3(sin(orbit) * 2.5, 1.14999997615814208984375, (-cos(orbit)) * 2.5);
    float3 fw = fast::normalize(float3(0.0, 0.119999997317790985107421875, 0.0) - ro);
    float3 rt = fast::normalize(cross(float3(0.0, 1.0, 0.0), fw));
    float3 rd = fast::normalize(((rt * p.x) + (cross(fw, rt) * p.y)) + (fw * 1.7999999523162841796875));
    float t = 0.0;
    bool hit = false;
    for (int i = 0; i < 110; i++)
    {
        float3 param = ro + (rd * t);
        float d = scene(param, _78, gHit, gTreble);
        if (d < (0.000600000028498470783233642578125 * t))
        {
            hit = true;
            break;
        }
        t += d;
        if (t > 9.0)
        {
            break;
        }
    }
    float3 col = float3(_78.uBackground) * (1.0 - (0.300000011920928955078125 * length(p)));
    if (hit)
    {
        float3 pos = ro + (rd * t);
        float3 param_1 = pos;
        float f = fluid(param_1, _78, gHit, gTreble);
        if (f < (pos.y + 0.001000000047497451305389404296875))
        {
            float2 e = float2(0.0007999999797903001308441162109375, -0.0007999999797903001308441162109375);
            float3 param_2 = pos + e.xyy;
            float3 param_3 = pos + e.yyx;
            float3 param_4 = pos + e.yxy;
            float3 param_5 = pos + e.xxx;
            float3 n = fast::normalize((((e.xyy * fluid(param_2, _78, gHit, gTreble)) + (e.yyx * fluid(param_3, _78, gHit, gTreble))) + (e.yxy * fluid(param_4, _78, gHit, gTreble))) + (e.xxx * fluid(param_5, _78, gHit, gTreble)));
            float fres = powr(1.0 - fast::max(dot(n, -rd), 0.0), 5.0);
            float3 param_6 = reflect(rd, n);
            col = float3(0.008000000379979610443115234375) + (studio(param_6, _78) * (0.2199999988079071044921875 + (0.7799999713897705078125 * fres)));
        }
        else
        {
            float ao = 0.3499999940395355224609375 + (0.64999997615814208984375 * smoothstep(0.0, 0.300000011920928955078125, f));
            col = (_78.uDish * (0.3499999940395355224609375 + (0.5 * smoothstep(-2.0, 1.0, -length(pos.xz))))) * ao;
            col = mix(col, float3(_78.uBackground), float3(smoothstep(1.39999997615814208984375, 2.599999904632568359375, length(pos.xz))));
        }
    }
    fragColor = float4(float3(1.0) - exp((-col) * 1.2999999523162841796875), 1.0);
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
    float3 _937;
    if (a > 0.0)
    {
        _937 = bg + (d / float3(a));
    }
    else
    {
        _937 = bg;
    }
    float3 fg = _937;
    float alpha = a + (opacity * (1.0 - a));
    float3 _959;
    if (alpha > 0.0)
    {
        _959 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _959 = bg;
    }
    float3 col = _959;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _78, thread float& gHit, thread float& gTreble)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _78, gHit, gTreble);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_78.uBackground);
    float param_4 = _78.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_ferrofluid_spikes_frag_out flair_ferrofluid_spikes_frag(constant FlairUniforms& _78 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_ferrofluid_spikes_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float gHit;
    float gTreble;
    float _1016;
    if (_78.flair_flipY > 0.5)
    {
        _1016 = _78.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1016 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1016);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _78, gHit, gTreble);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

