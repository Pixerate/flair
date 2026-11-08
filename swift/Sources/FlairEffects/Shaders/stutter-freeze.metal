// flair-metal-hash: c74c36a1
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
    float uRate;
    float uHold;
    float uFlash;
    float uMotion;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_stutter_freeze_frag_out
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
float2 coverOf(texture2d<float> tex, sampler texSmplr, constant FlairUniforms& _98)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float frameAspect = _98.iResolution[0u] / _98.iResolution[1u];
    float _275;
    if (size.x > 1.0)
    {
        _275 = size.x / size.y;
    }
    else
    {
        _275 = frameAspect;
    }
    float imageAspect = _275;
    float2 _289;
    if (frameAspect > imageAspect)
    {
        _289 = float2(1.0, imageAspect / frameAspect);
    }
    else
    {
        _289 = float2(frameAspect / imageAspect, 1.0);
    }
    return _289;
}

static inline __attribute__((always_inline))
float2 swayUv(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& t, thread const float& amount, constant FlairUniforms& _98)
{
    float2 cover = coverOf(tex, texSmplr, _98);
    float aspect = _98.iResolution[0u] / _98.iResolution[1u];
    float w = 0.785398006439208984375;
    float zoom = 1.2999999523162841796875 + ((0.180000007152557373046875 * amount) * sin((w * t) + 0.699999988079071044921875));
    float angle = (0.070000000298023223876953125 * amount) * sin(((2.0 * w) * t) + 0.4000000059604644775390625);
    float2 pan = float2((0.100000001490116119384765625 * sin(w * t)) + (0.039999999105930328369140625 * sin(((3.0 * w) * t) + 1.2999999523162841796875)), 0.070000000298023223876953125 * sin(((2.0 * w) * t) + 2.099999904632568359375)) * amount;
    float2 p = (uv - float2(0.5)) * float2(aspect, 1.0);
    float c = cos(angle);
    float s = sin(angle);
    p = (float2x2(float2(c, s), float2(-s, c)) * p) / float2(aspect, 1.0);
    return float2(0.5) + (((p / float2(zoom)) + pan) * cover);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _98)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_98.uBackdrop) * _98.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_98.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _98)
{
    float4 _240;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _240 = overBackdrop(param, _98);
    }
    else
    {
        float2 param_1 = fract(uv);
        _240 = float4(testCard(param_1), 1.0);
    }
    return _240;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _98, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_98.iResolution[0], _98.iResolution[1]);
    float slot = floor(_98.iTime * _98.uRate);
    float f = fract(_98.iTime * _98.uRate);
    float2 param = float2(slot, 3.2999999523162841796875);
    float len = _98.uHold * mix(0.3499999940395355224609375, 1.0, hash12(param));
    float startF = 1.0 - len;
    float2 param_1 = float2(slot, 7.099999904632568359375);
    bool frozen = ((hash12(param_1) > 0.25) && (len > 0.001000000047497451305389404296875)) && (f >= startF);
    float freezeAt = (slot + startF) / _98.uRate;
    float since = _98.iTime - freezeAt;
    float t = _98.iTime;
    float kick = 0.0;
    if (frozen)
    {
        float2 param_2 = float2(slot, 9.69999980926513671875);
        float stutter = step(0.550000011920928955078125, hash12(param_2));
        float k = floor(since * 12.0);
        t = freezeAt - ((stutter * mod(k, 3.0)) * 0.0599999986588954925537109375);
        kick = exp((-since) * 10.0);
    }
    float2 st = float2(0.5) + ((uv - float2(0.5)) / float2(1.0 + (0.039999999105930328369140625 * kick)));
    float2 param_3 = st;
    float param_4 = t * 2.0;
    float param_5 = _98.uMotion;
    float2 param_6 = swayUv(uImage, uImageSmplr, param_3, param_4, param_5, _98);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_6, _98);
    float3 col = pic.xyz;
    if (frozen)
    {
        col = mix(col, float3(dot(col, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875))), float3(0.25));
        col = ((col - float3(0.5)) * 1.10000002384185791015625) + float3(0.5);
    }
    col = mix(col, float3(1.0), float3((kick * _98.uFlash) * 0.85000002384185791015625));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::max(pic.w, (kick * _98.uFlash) * 0.85000002384185791015625));
}

fragment flair_stutter_freeze_frag_out flair_stutter_freeze_frag(constant FlairUniforms& _98 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_stutter_freeze_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _590;
    if (_98.flair_flipY > 0.5)
    {
        _590 = _98.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _590 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _590);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _98, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

