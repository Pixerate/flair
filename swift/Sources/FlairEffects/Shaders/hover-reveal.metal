// flair-metal-hash: ac3ff58d
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
    float uRadius;
    float uSoftness;
    char _m15_pad[8];
    packed_float3 uRim;
    uint uDemo;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_hover_reveal_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 hoverPoint(thread const bool& demo, thread const float& idle, constant FlairUniforms& _188)
{
    float2 drift = float2(_188.iResolution[0], _188.iResolution[1]) * (float2(0.5) + float2(0.2800000011920928955078125 * sin(_188.iTime * 0.62999999523162841796875), 0.2199999988079071044921875 * sin((_188.iTime * 0.910000026226043701171875) + 1.2999999523162841796875)));
    float h = fast::clamp(_188.iPointer.z, 0.0, 1.0);
    return float3(mix(drift, _188.iPointer.xy, float2(h)), mix(demo ? idle : 0.0, 1.0, h));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 clickAt(thread const int& i, thread const bool& demo, constant FlairUniforms& _188)
{
    bool _176 = !demo;
    bool _197;
    if (!_176)
    {
        _197 = _188.iClicks[0].w > 0.5;
    }
    else
    {
        _197 = _176;
    }
    if (_197)
    {
        return _188.iClicks[i];
    }
    float k = floor(_188.iTime / 2.0) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.1500000059604644775390625) + (h * 0.699999988079071044921875)) * float2(_188.iResolution[0], _188.iResolution[1]), k * 2.0, 1.0);
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _188)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_188.uBackdrop) * _188.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_188.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _188)
{
    float4 _425;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _425 = overBackdrop(param, _188);
    }
    else
    {
        float2 param_1 = fract(uv);
        _425 = float4(testCard(param_1), 1.0);
    }
    return _425;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _188, texture2d<float> uImage, sampler uImageSmplr, texture2d<float> uReveal, sampler uRevealSmplr)
{
    float2 uv = fragCoord / float2(_188.iResolution[0], _188.iResolution[1]);
    float px = 1.0 / _188.iResolution[1u];
    bool param = _188.uDemo != 0u;
    float param_1 = 0.85000002384185791015625;
    float3 hp = hoverPoint(param, param_1, _188);
    float pulse = 0.0;
    for (int i = 0; i < 8; i++)
    {
        int param_2 = i;
        bool param_3 = _188.uDemo != 0u;
        float4 c = clickAt(param_2, param_3, _188);
        float age = _188.iTime - c.z;
        if ((c.w < 0.5) || (age < 0.0))
        {
            continue;
        }
        pulse += ((0.60000002384185791015625 * exp((-age) * 4.0)) * (1.0 - exp((-age) * 30.0)));
    }
    float R = (_188.uRadius * hp.z) * (1.0 + pulse);
    float d = length(fragCoord - hp.xy) * px;
    float2 param_4 = ((fragCoord * px) * 9.0) + float2(_188.iTime * 0.60000002384185791015625);
    d += (((vnoise(param_4) - 0.5) * 0.25) * R);
    float soft = fast::max((_188.uSoftness * R) * 0.60000002384185791015625, 1.5 * px);
    float m = 1.0 - smoothstep(R - soft, R, d);
    float2 param_5 = uv;
    float2 param_6 = uv;
    float4 pic = mix(pictureRGBA(uImage, uImageSmplr, param_5, _188), pictureRGBA(uReveal, uRevealSmplr, param_6, _188), float4(m));
    float rim = exp(-powr(((d - R) + (soft * 0.5)) / fast::max(soft * 0.5, 2.0 * px), 2.0)) * step(0.001000000047497451305389404296875, R);
    float alpha = fast::max(pic.w, fast::clamp(rim * 0.60000002384185791015625, 0.0, 1.0));
    fragColor = float4(((pic.xyz * pic.w) + ((float3(_188.uRim) * rim) * 0.60000002384185791015625)) / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

fragment flair_hover_reveal_frag_out flair_hover_reveal_frag(constant FlairUniforms& _188 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uReveal [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uRevealSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_hover_reveal_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _642;
    if (_188.flair_flipY > 0.5)
    {
        _642 = _188.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _642 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _642);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _188, uImage, uImageSmplr, uReveal, uRevealSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

