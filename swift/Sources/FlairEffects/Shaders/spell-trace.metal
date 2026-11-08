// flair-metal-hash: 734b5356
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    float uSize;
    float uSpeed;
    float uTrail;
    float uLine;
    uint uDots;
    float uDotRing;
    float uSparkle;
    float uFlash;
    float3 uColor;
    packed_float3 uAccent;
    uint uDemo;
};

constant spvUnsafeArray<float2, 16> _383 = spvUnsafeArray<float2, 16>({ float2(0.17678000032901763916015625, 0.0), float2(-0.22576999664306640625, 0.2068299949169158935546875), float2(0.0345599986612796783447265625, -0.3937700092792510986328125), float2(0.2845700085163116455078125, 0.3711700141429901123046875), float2(-0.52222001552581787109375, -0.0923700034618377685546875), float2(0.494690001010894775390625, -0.31468999385833740234375), float2(-0.1654500067234039306640625, 0.6155300140380859375), float2(-0.31558001041412353515625, -0.607590019702911376953125), float2(0.684650003910064697265625, 0.250010013580322265625), float2(-0.7122499942779541015625, 0.294030010700225830078125), float2(0.3433299958705902099609375, -0.73373997211456298828125), float2(0.2537600100040435791015625, 0.80892002582550048828125), float2(-0.76476001739501953125, -0.443159997463226318359375), float2(0.89713001251220703125, -0.1972700059413909912109375), float2(-0.54746997356414794921875, 0.77880001068115234375), float2(-0.12653000652790069580078125, -0.976080000400543212890625) });
constant spvUnsafeArray<float2, 10> _1359 = spvUnsafeArray<float2, 10>({ float2(0.22360999882221221923828125, 0.0), float2(-0.2855800092220306396484375, 0.261619985103607177734375), float2(0.043710000813007354736328125, -0.4980899989604949951171875), float2(0.3599599897861480712890625, 0.469500005245208740234375), float2(-0.66057002544403076171875, -0.116839997470378875732421875), float2(0.625739991664886474609375, -0.3980599939823150634765625), float2(-0.20927999913692474365234375, 0.778590023517608642578125), float2(-0.3991700112819671630859375, -0.76854002475738525390625), float2(0.866020023822784423828125, 0.316240012645721435546875), float2(-0.900929987430572509765625, 0.37191998958587646484375) });

struct flair_spell_trace_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void setKey(thread const float& tolerance, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _182, thread float4& gMaskPlace)
{
    gKeyTolerance = tolerance;
    float4 c = uMask.sample(uMaskSmplr, float2(0.00999999977648258209228515625, 0.9900000095367431640625), level(0.0));
    gKeyColour = c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875));
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    float aspect = size.x / size.y;
    float h = fast::min(_182.uSize, ((_182.iResolution[0u] / _182.iResolution[1u]) * _182.uSize) / aspect);
    gMaskPlace = float4(1.0 / (h * aspect), 1.0 / h, size.y / h, float(size.x > 1.0));
}

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _182)
{
    bool _444 = _182.uDemo != 0u;
    bool _451;
    if (_444)
    {
        _451 = _182.iBeat == 0.0;
    }
    else
    {
        _451 = _444;
    }
    bool _462;
    if (_451)
    {
        _462 = dot(_182.iAudio, _182.iAudio) == 0.0;
    }
    else
    {
        _462 = _451;
    }
    return _462;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _182)
{
    return exp((-mod(_182.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _182)
{
    return exp((-mod(_182.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _182)
{
    if (!soundDemo(_182))
    {
        return _182.iAudio;
    }
    float k = demoKick(_182);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_182.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_182.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_182))) + (0.07999999821186065673828125 * sin(_182.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _182)
{
    float _536;
    if (soundDemo(_182))
    {
        _536 = mod(_182.iTime, 0.5);
    }
    else
    {
        _536 = _182.iBeat;
    }
    return _536;
}

static inline __attribute__((always_inline))
float farReach(thread const float2& q, texture2d<float> uMask, sampler uMaskSmplr, thread float4& gMaskPlace)
{
    float2 full = float2(int2(uMask.get_width(), uMask.get_height()));
    int lod = int(ceil(0.5 * log2(fast::max((full.x * full.y) / 64.0, 1.0))));
    int2 size = int2(uMask.get_width(lod), uMask.get_height(lod));
    float2 texel = float2(1.0) / (float2(size) * gMaskPlace.xy);
    float radius = fast::min(texel.x, texel.y);
    float k = 0.1500000059604644775390625 * radius;
    float best = 1000.0;
    float weight = 0.0;
    for (int y = 0; y < 64; y++)
    {
        if (y >= size.y)
        {
            break;
        }
        for (int x = 0; x < 64; x++)
        {
            if (x >= size.x)
            {
                break;
            }
            float a = uMask.read(uint2(int2(x, y)), lod).w;
            if (a < 0.02999999932944774627685546875)
            {
                continue;
            }
            float2 centre = (((float2(float(x), float(y)) + float2(0.5)) / float2(size)) - float2(0.5)) / gMaskPlace.xy;
            float d = length(q - centre) - (radius * sqrt(a));
            if (d < best)
            {
                weight = (weight * exp((d - best) / k)) + 1.0;
                best = d;
            }
            else
            {
                weight += exp((best - d) / k);
            }
        }
    }
    float _881;
    if (weight > 0.0)
    {
        _881 = fast::max((best - (k * log(weight))) + (0.439999997615814208984375 * radius), 0.0);
    }
    else
    {
        _881 = 1.0;
    }
    return _881;
}

static inline __attribute__((always_inline))
float shapeLod(thread const float2& p, thread const float& lod, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, thread float4& gMaskPlace)
{
    float2 uv = (p * gMaskPlace.xy) + float2(0.5);
    bool _226 = uv.x < 0.0;
    bool _233;
    if (!_226)
    {
        _233 = uv.x > 1.0;
    }
    else
    {
        _233 = _226;
    }
    bool _240;
    if (!_233)
    {
        _240 = uv.y < 0.0;
    }
    else
    {
        _240 = _233;
    }
    bool _247;
    if (!_240)
    {
        _247 = uv.y > 1.0;
    }
    else
    {
        _247 = _240;
    }
    if (_247)
    {
        return 0.0;
    }
    float4 c = uMask.sample(uMaskSmplr, uv, level(lod));
    float a = c.w;
    if (gKeyTolerance > 0.0)
    {
        float away = distance(c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875)), gKeyColour);
        a *= smoothstep(gKeyTolerance, gKeyTolerance + 0.119999997317790985107421875, away);
    }
    return a;
}

static inline __attribute__((always_inline))
float shapeAt(thread const float2& p, thread const float& blur, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _182, thread float4& gMaskPlace)
{
    if (gMaskPlace.w < 0.5)
    {
        float d = length(p) - (0.300000011920928955078125 * _182.uSize);
        return fast::clamp(0.5 - (d / fast::max(blur, 0.0040000001899898052215576171875)), 0.0, 1.0);
    }
    float2 param = p;
    float param_1 = log2(fast::max(blur * gMaskPlace.z, 1.0));
    return shapeLod(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, gMaskPlace);
}

static inline __attribute__((always_inline))
float coverage(thread const float2& p, thread const float& radius, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _182, thread float4& gMaskPlace)
{
    float sum = 0.0;
    if (gMaskPlace.w < 0.5)
    {
        for (int i = 0; i < 16; i++)
        {
            float2 param = p + (_383[i] * radius);
            float param_1 = radius * 0.4000000059604644775390625;
            sum += shapeAt(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _182, gMaskPlace);
        }
    }
    else
    {
        float lod = log2(fast::max((radius * 0.4000000059604644775390625) * gMaskPlace.z, 1.0));
        for (int i_1 = 0; i_1 < 16; i_1++)
        {
            float2 param_2 = p + (_383[i_1] * radius);
            float param_3 = lod;
            sum += shapeLod(param_2, param_3, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, gMaskPlace);
        }
    }
    return sum / 16.0;
}

static inline __attribute__((always_inline))
float nearReach(thread const float2& q, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _182, thread float4& gMaskPlace)
{
    float r0 = 0.0;
    float2 param = q;
    float param_1 = 0.0030000000260770320892333984375;
    float c0 = shapeAt(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _182, gMaskPlace);
    if (c0 >= 0.0199999995529651641845703125)
    {
        return 0.0;
    }
    float r = 0.008000000379979610443115234375;
    for (int i = 0; i < 7; i++)
    {
        float2 param_2 = q;
        float param_3 = r;
        float c = coverage(param_2, param_3, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _182, gMaskPlace);
        if (c >= 0.0199999995529651641845703125)
        {
            return 0.89999997615814208984375 * mix(r0, r, (0.0199999995529651641845703125 - c0) / fast::max(c - c0, 9.9999997473787516355514526367188e-05));
        }
        r0 = r;
        c0 = c;
        r *= 1.5;
    }
    return 0.89999997615814208984375 * r0;
}

static inline __attribute__((always_inline))
float reach(thread const float2& q, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _182, thread float4& gMaskPlace)
{
    if (gMaskPlace.w < 0.5)
    {
        return fast::max(length(q) - (0.300000011920928955078125 * _182.uSize), 0.0);
    }
    float2 param = q;
    float far = farReach(param, uMask, uMaskSmplr, gMaskPlace);
    if (far > 0.119999997317790985107421875)
    {
        return far;
    }
    float2 param_1 = q;
    float near = nearReach(param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _182, gMaskPlace);
    return mix(near, far, smoothstep(0.039999999105930328369140625, 0.070000000298023223876953125, near));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _182)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_182))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_182.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_182.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_182.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_182)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_182)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_182.iSpectrum[i / 4][spvSMod(i, 4)], _182.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _182, thread float4& gMaskPlace)
{
    float param = 0.0;
    setKey(param, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _182, gMaskPlace);
    float px = 1.0 / _182.iResolution[1u];
    float2 p = (fragCoord - (float2(_182.iResolution[0], _182.iResolution[1]) * 0.5)) * px;
    float4 s = sound(_182);
    float b = beat(_182);
    float _957;
    if (b >= 0.0)
    {
        _957 = exp((-b) * 4.0);
    }
    else
    {
        _957 = 0.0;
    }
    float hit = _957;
    float t = _182.iTime;
    float2 param_1 = p;
    float d = reach(param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _182, gMaskPlace);
    float2 param_2 = p;
    float param_3 = px;
    float outside = 1.0 - shapeAt(param_2, param_3, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _182, gMaskPlace);
    float a = fract(0.25 - (precise::atan2(p.y, p.x) / 6.283185482025146484375));
    float head = fract(((t * _182.uSpeed) * 0.1500000059604644775390625) + (0.100000001490116119384765625 * s.y));
    float behind = fract(head - a);
    float trail = exp((-behind) / fast::max(_182.uTrail, 0.00999999977648258209228515625));
    float2 param_4 = p;
    float param_5 = 3.0 * px;
    float v = coverage(param_4, param_5, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _182, gMaskPlace) - 0.5;
    float edge = abs(v) / fast::max(length(float2(dfdx(v), dfdy(v))), 0.0199999995529651641845703125);
    float line = exp(-powr(edge / _182.uLine, 2.0)) + (0.25 * exp((-edge) / (_182.uLine * 4.0)));
    float3 light = (_182.uColor * line) * (0.1500000059604644775390625 + (trail * (1.5 + (1.2000000476837158203125 * s.x))));
    float spark = 2.0 * exp((-behind) / 0.008000000379979610443115234375);
    light += ((float3(_182.uAccent) * spark) * ((2.0 * line) + ((0.5 * exp((-d) / 0.00999999977648258209228515625)) * outside)));
    float2 g = (p + float2(0.0, (-t) * 0.02500000037252902984619140625)) * 80.0;
    float2 cell = floor(g);
    float2 param_6 = cell;
    float h = hash12(param_6);
    if (h > (1.0 - (0.0599999986588954925537109375 * _182.uSparkle)))
    {
        float2 param_7 = cell;
        float2 at = (((cell + float2(0.300000011920928955078125)) + (hash22(param_7) * 0.4000000059604644775390625)) / float2(80.0)) + float2(0.0, t * 0.02500000037252902984619140625);
        float m = length(p - at);
        float twinkle = 0.5 + (0.5 * sin((t * 7.0) + (h * 60.0)));
        light += ((((((mix(_182.uColor, float3(_182.uAccent), float3(0.5)) * exp(((-m) * m) / 4.5000001591688487678766250610352e-06)) * twinkle) * exp((-d) / 0.02999999932944774627685546875)) * outside) * trail) * (0.60000002384185791015625 + s.w));
    }
    if (_182.uDots != 0u)
    {
        float dots = 64.0;
        float i = floor(a * dots);
        float param_8 = (i + 0.5) / dots;
        float _1200 = spectrum(param_8, _182);
        float level0 = _1200;
        float along = ((((fract(a * dots) - 0.5) * 2.0) * 3.1415927410125732421875) * length(p)) / dots;
        float r = length(float2(along, d - _182.uDotRing));
        float size = 0.00120000005699694156646728515625 + (0.0035000001080334186553955078125 * level0);
        light += (_182.uColor * ((smoothstep(size + px, size - px, r) * (0.25 + (0.89999997615814208984375 * level0))) + ((0.300000011920928955078125 * level0) * exp((-r) / 0.006000000052154064178466796875))));
    }
    light += (((((_182.uColor * _182.uFlash) * hit) * exp(-powr((d - (fast::max(b, 0.0) * 0.3499999940395355224609375)) / 0.0040000001899898052215576171875, 2.0))) * outside) * 0.800000011920928955078125);
    light += ((((float3(_182.uAccent) * _182.uFlash) * hit) * line) * 0.60000002384185791015625);
    float3 param_9 = light * 1.2000000476837158203125;
    float4 _1294 = glow(param_9);
    fragColor = _1294;
}

fragment flair_spell_trace_frag_out flair_spell_trace_frag(constant FlairUniforms& _182 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_spell_trace_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float gKeyTolerance;
    float3 gKeyColour;
    float4 gMaskPlace;
    float _1307;
    if (_182.flair_flipY > 0.5)
    {
        _1307 = _182.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1307 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1307);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _182, gMaskPlace);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

