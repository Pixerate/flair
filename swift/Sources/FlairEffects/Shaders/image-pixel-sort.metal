// flair-metal-hash: 32dfb1a2
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
    int uDirection;
    float uLow;
    float uHigh;
    float uLength;
    float uPixel;
    uint uReverse;
    float uSweep;
    char _m20_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_pixel_sort_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 cellUV(thread const float2& cell, constant FlairUniforms& _100)
{
    return ((cell + float2(0.5)) * _100.uPixel) / float2(_100.iResolution[0], _100.iResolution[1]);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _100)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_100.uBackdrop) * _100.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_100.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _100)
{
    float4 _242;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _242 = overBackdrop(param, _100);
    }
    else
    {
        float2 param_1 = fract(uv);
        _242 = float4(testCard(param_1), 1.0);
    }
    return _242;
}

static inline __attribute__((always_inline))
float luma(thread const float3& c)
{
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _100)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _100).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _100, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 cell = floor(fragCoord / float2(_100.uPixel));
    float2 grid = ceil(float2(_100.iResolution[0], _100.iResolution[1]) / float2(_100.uPixel));
    float2 _311;
    if (_100.uDirection == 0)
    {
        _311 = float2(0.0, -1.0);
    }
    else
    {
        float2 _321;
        if (_100.uDirection == 1)
        {
            _321 = float2(0.0, 1.0);
        }
        else
        {
            _321 = select(float2(-1.0, 0.0), float2(1.0, 0.0), bool2(_100.uDirection == 2));
        }
        _311 = _321;
    }
    float2 dir = _311;
    float lo = _100.uLow + (_100.uSweep * sin((_100.iTime * 6.28318023681640625) / 8.0));
    float2 param = cell;
    float2 param_1 = cellUV(param, _100);
    float4 here = pictureRGBA(uImage, uImageSmplr, param_1, _100);
    float3 param_2 = here.xyz;
    float l = luma(param_2);
    bool _366 = l < lo;
    bool _375;
    if (!_366)
    {
        _375 = l > _100.uHigh;
    }
    else
    {
        _375 = _366;
    }
    if (_375)
    {
        fragColor = here;
        return;
    }
    float cap = floor(_100.uLength);
    float line = dot(cell, abs(dir.yx));
    float t = dot(cell, dir);
    float2 param_3 = float2(line, 3.7000000476837158203125);
    float phase = floor(hash12(param_3) * cap);
    float segStart = (floor((t + phase) / cap) * cap) - phase;
    float segEnd = (segStart + cap) - 1.0;
    float back = 0.0;
    for (int i = 1; i < 128; i++)
    {
        float s = float(i);
        float2 c = cell - (dir * s);
        bool _444 = (t - s) < segStart;
        bool _451;
        if (!_444)
        {
            _451 = c.x < 0.0;
        }
        else
        {
            _451 = _444;
        }
        bool _458;
        if (!_451)
        {
            _458 = c.y < 0.0;
        }
        else
        {
            _458 = _451;
        }
        bool _467;
        if (!_458)
        {
            _467 = c.x >= grid.x;
        }
        else
        {
            _467 = _458;
        }
        bool _476;
        if (!_467)
        {
            _476 = c.y >= grid.y;
        }
        else
        {
            _476 = _467;
        }
        if (_476)
        {
            break;
        }
        float2 param_4 = c;
        float2 param_5 = cellUV(param_4, _100);
        float3 param_6 = picture(uImage, uImageSmplr, param_5, _100);
        float m = luma(param_6);
        bool _490 = m < lo;
        bool _498;
        if (!_490)
        {
            _498 = m > _100.uHigh;
        }
        else
        {
            _498 = _490;
        }
        if (_498)
        {
            break;
        }
        back = s;
    }
    float fwd = 0.0;
    for (int i_1 = 1; i_1 < 128; i_1++)
    {
        float s_1 = float(i_1);
        float2 c_1 = cell + (dir * s_1);
        bool _527 = (t + s_1) > segEnd;
        bool _534;
        if (!_527)
        {
            _534 = c_1.x < 0.0;
        }
        else
        {
            _534 = _527;
        }
        bool _541;
        if (!_534)
        {
            _541 = c_1.y < 0.0;
        }
        else
        {
            _541 = _534;
        }
        bool _550;
        if (!_541)
        {
            _550 = c_1.x >= grid.x;
        }
        else
        {
            _550 = _541;
        }
        bool _559;
        if (!_550)
        {
            _559 = c_1.y >= grid.y;
        }
        else
        {
            _559 = _550;
        }
        if (_559)
        {
            break;
        }
        float2 param_7 = c_1;
        float2 param_8 = cellUV(param_7, _100);
        float3 param_9 = picture(uImage, uImageSmplr, param_8, _100);
        float m_1 = luma(param_9);
        bool _573 = m_1 < lo;
        bool _581;
        if (!_573)
        {
            _581 = m_1 > _100.uHigh;
        }
        else
        {
            _581 = _573;
        }
        if (_581)
        {
            break;
        }
        fwd = s_1;
    }
    float len = back + fwd;
    spvUnsafeArray<float3, 8> col;
    spvUnsafeArray<float, 8> key;
    float _636;
    for (int k = 0; k < 8; k++)
    {
        float s_2 = floor(((-back) + ((len * float(k)) / 7.0)) + 0.5);
        float2 param_10 = cell + (dir * s_2);
        float2 param_11 = cellUV(param_10, _100);
        col[k] = picture(uImage, uImageSmplr, param_11, _100);
        if (_100.uReverse != 0u)
        {
            float3 param_12 = col[k];
            _636 = -luma(param_12);
        }
        else
        {
            float3 param_13 = col[k];
            _636 = luma(param_13);
        }
        key[k] = _636;
    }
    for (int i_2 = 1; i_2 < 8; i_2++)
    {
        for (int j = i_2; j > 0; j--)
        {
            if (key[j - 1] <= key[j])
            {
                break;
            }
            float kt = key[j];
            key[j] = key[j - 1];
            key[j - 1] = kt;
            float3 ct = col[j];
            col[j] = col[j - 1];
            col[j - 1] = ct;
        }
    }
    float _718;
    if (len > 0.0)
    {
        _718 = (back / len) * 7.0;
    }
    else
    {
        _718 = 0.0;
    }
    float r = _718;
    int a = int(floor(r));
    int b = min((a + 1), 7);
    fragColor = float4(mix(col[a], col[b], float3(fract(r))), here.w);
}

fragment flair_image_pixel_sort_frag_out flair_image_pixel_sort_frag(constant FlairUniforms& _100 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_pixel_sort_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _764;
    if (_100.flair_flipY > 0.5)
    {
        _764 = _100.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _764 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _764);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _100, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

