// flair-metal-hash: 5d37215f
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
    uint uAnimate;
    float uProgress;
    float uTear;
    float uSplit;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_static_cut_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _104)
{
    float _359;
    if (_104.uAnimate != 0u)
    {
        _359 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_104.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _359 = _104.uProgress;
    }
    return _359;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _104)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _249 = ts.x <= 1;
    bool _256;
    if (!_249)
    {
        _256 = ts.y <= 1;
    }
    else
    {
        _256 = _249;
    }
    bool _264;
    if (!_256)
    {
        _264 = _104.iResolution[0u] <= 0.0;
    }
    else
    {
        _264 = _256;
    }
    bool _271;
    if (!_264)
    {
        _271 = _104.iResolution[1u] <= 0.0;
    }
    else
    {
        _271 = _264;
    }
    if (_271)
    {
        return uv;
    }
    float boxAspect = _104.iResolution[0u] / _104.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _294;
    if (boxAspect > texAspect)
    {
        _294 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _294 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _294;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _104)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_104.uBackdrop) * _104.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_104.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _104)
{
    float4 _321;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _321 = overBackdrop(param, _104);
    }
    else
    {
        float2 param_1 = fract(uv);
        _321 = float4(testCard(param_1), 1.0);
    }
    return _321;
}

static inline __attribute__((always_inline))
float4 pictureCoverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _104)
{
    float2 param = uv;
    float2 param_1 = fitCoverUV(tex, texSmplr, param, _104);
    return pictureRGBA(tex, texSmplr, param_1, _104);
}

static inline __attribute__((always_inline))
float3 pictureCover(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _104)
{
    float2 param = uv;
    return pictureCoverRGBA(tex, texSmplr, param, _104).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _104, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_104.iResolution[0], _104.iResolution[1]);
    float k = progress(_104);
    float _noise = smoothstep(0.119999997317790985107421875, 0.449999988079071044921875, k) * (1.0 - smoothstep(0.550000011920928955078125, 0.87999999523162841796875, k));
    float frame = floor(_104.iTime * 30.0);
    float line = floor(uv.y * 200.0);
    float2 param = float2(line, frame);
    float shift = ((((hash12(param) - 0.5) * 0.1500000059604644775390625) * _104.uTear) * _noise) * _noise;
    float roll = fract((uv.y * 1.2999999523162841796875) + (_104.iTime * 1.7000000476837158203125));
    float bar = (smoothstep(0.0, 0.02999999932944774627685546875, roll) * smoothstep(0.1500000059604644775390625, 0.0500000007450580596923828125, roll)) * _noise;
    float2 st = uv + float2(shift + (bar * 0.0500000007450580596923828125), 0.0);
    float2 sp = float2(_104.uSplit * _noise, 0.0);
    float4 _466;
    if (k < 0.5)
    {
        float2 param_1 = st;
        _466 = pictureCoverRGBA(uFrom, uFromSmplr, param_1, _104);
    }
    else
    {
        float2 param_2 = st;
        _466 = pictureCoverRGBA(uTo, uToSmplr, param_2, _104);
    }
    float4 g = _466;
    float3 _482;
    if (k < 0.5)
    {
        float2 param_3 = st + sp;
        float2 param_4 = st - sp;
        _482 = float3(pictureCover(uFrom, uFromSmplr, param_3, _104).x, g.y, pictureCover(uFrom, uFromSmplr, param_4, _104).z);
    }
    else
    {
        float2 param_5 = st + sp;
        float2 param_6 = st - sp;
        _482 = float3(pictureCover(uTo, uToSmplr, param_5, _104).x, g.y, pictureCover(uTo, uToSmplr, param_6, _104).z);
    }
    float3 c = _482;
    float2 param_7 = fragCoord + float2(frame * 13.0);
    float snow = hash12(param_7);
    float3 col = mix(c, float3((snow * 0.85000002384185791015625) + 0.07999999821186065673828125), float3(fast::clamp(((_noise * 1.2000000476837158203125) - 0.100000001490116119384765625) + (bar * 0.5), 0.0, 1.0)));
    fragColor = float4(col, fast::max(g.w, _noise));
}

fragment flair_transition_static_cut_frag_out flair_transition_static_cut_frag(constant FlairUniforms& _104 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_static_cut_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _564;
    if (_104.flair_flipY > 0.5)
    {
        _564 = _104.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _564 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _564);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _104, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

