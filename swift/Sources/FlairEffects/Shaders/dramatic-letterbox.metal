// flair-metal-hash: bb9852e9
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
    float uAspect;
    char _m14_pad[12];
    packed_float3 uBar;
    float uSlam;
    float uPush;
    float uGrade;
    float3 uShadowTint;
    packed_float3 uHighlightTint;
    uint uAnimate;
    float uProgress;
    char _m22_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_dramatic_letterbox_frag_out
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
    float2 size = float2(_53.iResolution[0], _53.iResolution[1]);
    float bars = _53.uProgress;
    float grade = _53.uProgress;
    float push = _53.uProgress;
    float2 shake = float2(0.0);
    if (_53.uAnimate != 0u)
    {
        float c = mod(_53.iTime, 6.0);
        float x = fast::clamp((c - 0.60000002384185791015625) / 0.300000011920928955078125, 0.0, 1.0);
        float landed = fast::max(c - 0.89999997615814208984375, 0.0);
        float _267;
        if (c > 0.89999997615814208984375)
        {
            _267 = ((_53.uSlam * 0.1599999964237213134765625) * exp((-landed) * 9.0)) * sin(landed * 28.0);
        }
        else
        {
            _267 = 0.0;
        }
        float bounce = _267;
        bars = ((x * x) + bounce) * (1.0 - smoothstep(5.0, 5.5, c));
        grade = smoothstep(0.60000002384185791015625, 1.2000000476837158203125, c) * (1.0 - smoothstep(5.0, 5.599999904632568359375, c));
        float _307;
        if (c < 5.0)
        {
            _307 = smoothstep(0.60000002384185791015625, 5.0, c);
        }
        else
        {
            _307 = 1.0 - smoothstep(5.0, 5.80000019073486328125, c);
        }
        push = _307;
        if (c > 0.89999997615814208984375)
        {
            shake = float2(sin(landed * 61.0), sin((landed * 47.0) + 1.0)) * ((_53.uSlam * 0.00999999977648258209228515625) * exp((-landed) * 7.0));
        }
    }
    float2 param = (float2(0.5) + ((uv - float2(0.5)) / float2(1.0 + (_53.uPush * push)))) + shake;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _53);
    float3 col = pic.xyz;
    float lum = dot(col, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float g = grade * _53.uGrade;
    col = mix(col, float3(lum), float3(0.3499999940395355224609375 * g));
    col = mix(col, (col * col) * (float3(3.0) - (col * 2.0)), float3(0.699999988079071044921875 * g));
    col += ((mix(_53.uShadowTint, float3(_53.uHighlightTint), float3(smoothstep(0.1500000059604644775390625, 0.85000002384185791015625, lum))) - float3(0.5)) * (g * 0.300000011920928955078125));
    col *= (1.0 - (g * (0.119999997317790985107421875 + (0.3499999940395355224609375 * smoothstep(0.3499999940395355224609375, 0.89999997615814208984375, length((uv - float2(0.5)) * float2((size.x / size.y) / 1.5, 1.0)))))));
    bool pillar = _53.uAspect < (size.x / size.y);
    float _453;
    if (pillar)
    {
        _453 = fragCoord.x;
    }
    else
    {
        _453 = fragCoord.y;
    }
    float pos = _453;
    float _464;
    if (pillar)
    {
        _464 = size.x;
    }
    else
    {
        _464 = size.y;
    }
    float extent = _464;
    float _475;
    if (pillar)
    {
        _475 = size.y * _53.uAspect;
    }
    else
    {
        _475 = size.x / _53.uAspect;
    }
    float opening = _475;
    float bar = (fast::max(0.0, extent - opening) * 0.5) * fast::max(bars, 0.0);
    float cover = 1.0 - smoothstep(-0.5, 0.5, fast::min(pos - bar, (extent - bar) - pos));
    float alpha = mix(pic.w, 1.0, cover);
    fragColor = float4(mix(fast::clamp(col, float3(0.0), float3(1.0)), float3(_53.uBar), float3(cover)), alpha);
}

fragment flair_dramatic_letterbox_frag_out flair_dramatic_letterbox_frag(constant FlairUniforms& _53 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_dramatic_letterbox_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _544;
    if (_53.flair_flipY > 0.5)
    {
        _544 = _53.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _544 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _544);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _53, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

