// flair-metal-hash: 6de1303a
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
    char _m15_pad[8];
    packed_float3 uHot;
    float uX;
    float uY;
    float uMelt;
    char _m19_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_film_burn_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _216)
{
    float _458;
    if (_216.uAnimate != 0u)
    {
        _458 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_216.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _458 = _216.uProgress;
    }
    return _458;
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
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _216)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _355 = ts.x <= 1;
    bool _362;
    if (!_355)
    {
        _362 = ts.y <= 1;
    }
    else
    {
        _362 = _355;
    }
    bool _369;
    if (!_362)
    {
        _369 = _216.iResolution[0u] <= 0.0;
    }
    else
    {
        _369 = _362;
    }
    bool _376;
    if (!_369)
    {
        _376 = _216.iResolution[1u] <= 0.0;
    }
    else
    {
        _376 = _369;
    }
    if (_376)
    {
        return uv;
    }
    float boxAspect = _216.iResolution[0u] / _216.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _399;
    if (boxAspect > texAspect)
    {
        _399 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _399 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _399;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _216)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_216.uBackdrop) * _216.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_216.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _216)
{
    float4 _426;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _426 = overBackdrop(param, _216);
    }
    else
    {
        float2 param_1 = fract(uv);
        _426 = float4(testCard(param_1), 1.0);
    }
    return _426;
}

static inline __attribute__((always_inline))
float4 pictureCoverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _216)
{
    float2 param = uv;
    float2 param_1 = fitCoverUV(tex, texSmplr, param, _216);
    return pictureRGBA(tex, texSmplr, param_1, _216);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _216, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_216.iResolution[0], _216.iResolution[1]);
    float aspect = _216.iResolution[0u] / _216.iResolution[1u];
    float k = progress(_216);
    float2 p = (fragCoord - (float2(_216.iResolution[0], _216.iResolution[1]) * 0.5)) / float2(_216.iResolution[1u]);
    float2 rel = p - float2(_216.uX * aspect, _216.uY);
    float r = 1.75 * powr(k, 1.7000000476837158203125);
    float2 param = rel * 6.0;
    int param_1 = 4;
    float _532 = fbm(param, param_1);
    float edge = length(rel) + (((_532 - 0.5) * 0.119999997317790985107421875) * (0.300000011920928955078125 + r));
    float open = step(9.9999997473787516355514526367188e-05, r);
    float near = (exp((-fast::max(edge - r, 0.0)) / 0.07999999821186065673828125) * open) * (1.0 - smoothstep(0.85000002384185791015625, 1.0, k));
    float2 param_2 = uv - ((((fast::normalize(rel + float2(9.9999997473787516355514526367188e-06)) * near) * 0.039999999105930328369140625) * _216.uMelt) / float2(aspect, 1.0));
    float4 from = pictureCoverRGBA(uFrom, uFromSmplr, param_2, _216);
    float2 param_3 = uv;
    float4 to = pictureCoverRGBA(uTo, uToSmplr, param_3, _216);
    float charred = smoothstep(r + 0.0599999986588954925537109375, r + 0.00999999977648258209228515625, edge) * open;
    float4 _594 = from;
    float3 _603 = mix(_594.xyz, float3(0.0500000007450580596923828125, 0.02999999932944774627685546875, 0.0199999995529651641845703125), float3(charred * 0.85000002384185791015625));
    from.x = _603.x;
    from.y = _603.y;
    from.z = _603.z;
    float glow = exp((-abs(edge - r)) / 0.01200000010430812835693359375) * open;
    float hole = smoothstep(r, r - 0.00999999977648258209228515625, edge) * open;
    float4 col = mix(from, to, float4(hole));
    float4 _635 = col;
    float3 _647 = mix(_635.xyz, float3(_216.uHot), float3(fast::clamp(glow, 0.0, 1.0) * (1.0 - smoothstep(0.85000002384185791015625, 1.0, k))));
    col.x = _647.x;
    col.y = _647.y;
    col.z = _647.z;
    fragColor = col;
}

fragment flair_transition_film_burn_frag_out flair_transition_film_burn_frag(constant FlairUniforms& _216 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_film_burn_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _667;
    if (_216.flair_flipY > 0.5)
    {
        _667 = _216.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _667 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _667);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _216, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

