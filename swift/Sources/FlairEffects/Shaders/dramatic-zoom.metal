// flair-metal-hash: 0bc034ec
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
    float2 uTarget;
    float uZoom;
    int uSteps;
    float uStepTime;
    float uHold;
    float uShake;
    float uVignette;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_dramatic_zoom_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _53)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_53.uBackdrop) * _53.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_53.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _53)
{
    float4 _197;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _197 = overBackdrop(param, _53);
    }
    else
    {
        float2 param_1 = fract(uv);
        _197 = float4(testCard(param_1), 1.0);
    }
    return _197;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _53, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_53.iResolution[0], _53.iResolution[1]);
    float steps = float(_53.uSteps);
    float cycle = (0.699999988079071044921875 + (steps * _53.uStepTime)) + _53.uHold;
    float t = mod(_53.iTime, cycle) - 0.699999988079071044921875;
    float level0 = 0.0;
    float age = 99.0;
    if (t >= 0.0)
    {
        float k = fast::min(floor(t / _53.uStepTime), steps - 1.0);
        age = t - (k * _53.uStepTime);
        float e = fast::clamp(age / 0.0900000035762786865234375, 0.0, 1.0);
        e = (1.0 + (2.7000000476837158203125 * powr(e - 1.0, 3.0))) + (1.7000000476837158203125 * powr(e - 1.0, 2.0));
        level0 = (k + e) / steps;
    }
    float z = powr(_53.uZoom, level0);
    float2 c = _53.uTarget + ((float2(0.5) - _53.uTarget) / float2(z));
    float2 st = c + ((uv - float2(0.5)) / float2(z));
    float kick = (_53.uShake * exp((-age) * 16.0)) * step(0.0, t);
    st += (float2(sin(age * 90.0), cos((age * 70.0) + 1.0)) * ((kick * 0.02999999932944774627685546875) / z));
    float2 param = st;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _53);
    float3 col = pic.xyz;
    float aspect = _53.iResolution[0u] / _53.iResolution[1u];
    float r = length((uv - float2(0.5)) * float2(aspect, 1.0));
    col *= (1.0 - ((_53.uVignette * level0) * smoothstep(0.25, 0.949999988079071044921875, r)));
    col = mix(col, ((col - float3(0.5)) * 1.25) + float3(0.5), float3(level0 * 0.60000002384185791015625));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), pic.w);
}

fragment flair_dramatic_zoom_frag_out flair_dramatic_zoom_frag(constant FlairUniforms& _53 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_dramatic_zoom_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _422;
    if (_53.flair_flipY > 0.5)
    {
        _422 = _53.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _422 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _422);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _53, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

