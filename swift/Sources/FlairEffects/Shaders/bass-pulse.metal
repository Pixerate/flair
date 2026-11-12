// flair-metal-hash: 9eb71c35
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float uSize;
    float uPulse;
    char _m15_pad[8];
    packed_float3 uGlowColor;
    float uGlow;
    float uSplit;
    float uCorner;
    char _m19_pad[8];
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    uint uDemo;
};

struct flair_bass_pulse_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _78)
{
    bool _245 = _78.uDemo != 0u;
    bool _253;
    if (_245)
    {
        _253 = _78.iBeat == 0.0;
    }
    else
    {
        _253 = _245;
    }
    bool _264;
    if (_253)
    {
        _264 = dot(_78.iAudio, _78.iAudio) == 0.0;
    }
    else
    {
        _264 = _253;
    }
    return _264;
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
    float _339;
    if (soundDemo(_78))
    {
        _339 = mod(_78.iTime, 0.5);
    }
    else
    {
        _339 = _78.iBeat;
    }
    return _339;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _78)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_78.uBackdrop) * _78.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_78.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _78)
{
    float4 _221;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _221 = overBackdrop(param, _78);
    }
    else
    {
        float2 param_1 = fract(uv);
        _221 = float4(testCard(param_1), 1.0);
    }
    return _221;
}

static inline __attribute__((always_inline))
float4 card(thread const float2& p, thread const float2& hs, constant FlairUniforms& _78, texture2d<float> uImage, sampler uImageSmplr)
{
    float corner = _78.uCorner * fast::min(hs.x, hs.y);
    float2 q = (abs(p) - hs) + float2(corner);
    float d = (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - corner;
    float inside = fast::clamp(0.5 - (d * _78.iResolution[1u]), 0.0, 1.0);
    if (inside <= 0.0)
    {
        return float4(0.0);
    }
    float2 param = (p / (hs * 2.0)) + float2(0.5);
    float4 c = pictureRGBA(uImage, uImageSmplr, param, _78);
    return float4(c.xyz, c.w * inside);
}

static inline __attribute__((always_inline))
float glowAt(thread const float2& p, thread const float2& hs, thread const float& spread, constant FlairUniforms& _78, texture2d<float> uImage, sampler uImageSmplr)
{
    float corner = _78.uCorner * fast::min(hs.x, hs.y);
    float2 q = (abs(p) - hs) + float2(corner);
    float d = (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - corner;
    float box = exp((-fast::max(d, 0.0)) / spread);
    bool _461 = int2(uImage.get_width(), uImage.get_height()).x <= 1;
    bool _468;
    if (!_461)
    {
        _468 = _78.uBackdropAlpha >= 1.0;
    }
    else
    {
        _468 = _461;
    }
    if (_468)
    {
        return box;
    }
    float2 uv = (p / (hs * 2.0)) + float2(0.5);
    float lod = log2(float(int2(uImage.get_width(), uImage.get_height()).x));
    float blurred = fast::min(1.0, (0.60000002384185791015625 * uImage.sample(uImageSmplr, uv, level(lod - 4.5)).w) + (0.800000011920928955078125 * uImage.sample(uImageSmplr, uv, level(lod - 3.0)).w));
    float inside = step(abs(uv.x - 0.5), 0.5) * step(abs(uv.y - 0.5), 0.5);
    return mix(blurred * inside, box, _78.uBackdropAlpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _78, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 p = (fragCoord - (float2(_78.iResolution[0], _78.iResolution[1]) * 0.5)) / float2(_78.iResolution[1u]);
    float4 s = sound(_78);
    float b = beat(_78);
    float _547;
    if (b >= 0.0)
    {
        _547 = exp((-b) * 6.0);
    }
    else
    {
        _547 = 0.0;
    }
    float hit = _547;
    float bass = s.y * s.y;
    float scale = 1.0 + (_78.uPulse * ((bass * 0.699999988079071044921875) + (hit * 0.5)));
    float2 size = float2(int2(uImage.get_width(), uImage.get_height()));
    float _583;
    if (size.x > 1.0)
    {
        _583 = size.x / size.y;
    }
    else
    {
        _583 = 1.77777779102325439453125;
    }
    float aspect = _583;
    float2 hs = float2(aspect, 1.0) * ((0.5 * _78.uSize) * scale);
    hs *= fast::min(1.0, ((0.449999988079071044921875 * _78.iResolution[0u]) / _78.iResolution[1u]) / hs.x);
    float2 off = float2(_78.uSplit * hit, 0.0);
    float2 param = p;
    float2 param_1 = hs;
    float4 c = card(param, param_1, _78, uImage, uImageSmplr);
    float2 param_2 = p - off;
    float2 param_3 = hs;
    float4 cr = card(param_2, param_3, _78, uImage, uImageSmplr);
    float2 param_4 = p + off;
    float2 param_5 = hs;
    float4 cb = card(param_4, param_5, _78, uImage, uImageSmplr);
    float3 pic = float3(cr.x, c.y, cb.z);
    float cover = fast::max(c.w, fast::max(cr.w, cb.w));
    float spread = (0.0199999995529651641845703125 + (0.0500000007450580596923828125 * bass)) + (0.02999999932944774627685546875 * hit);
    float2 param_6 = p;
    float2 param_7 = hs;
    float param_8 = spread;
    float g = (glowAt(param_6, param_7, param_8, _78, uImage, uImageSmplr) * ((0.449999988079071044921875 + (0.89999997615814208984375 * bass)) + (0.60000002384185791015625 * hit))) * _78.uGlow;
    float3 col = float3(_78.uBackground) + ((float3(_78.uGlowColor) * g) * (1.0 - cover));
    float alpha = fast::max(_78.uBackgroundAlpha, fast::clamp(g, 0.0, 1.0));
    col = mix(col, pic * (1.0 + (0.25 * hit)), float3(cover));
    fragColor = float4(col, fast::max(alpha, cover));
}

fragment flair_bass_pulse_frag_out flair_bass_pulse_frag(constant FlairUniforms& _78 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_bass_pulse_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _742;
    if (_78.flair_flipY > 0.5)
    {
        _742 = _78.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _742 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _742);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _78, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

